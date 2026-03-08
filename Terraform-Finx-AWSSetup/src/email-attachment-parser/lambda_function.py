"""
Lambda 1: AP Invoice Audit & Classifier with Workato ERP Integration (CORRECTED + PATCHED)
-------------------------------------------------------------------------------------------
What this version fixes over OLD code:
✅ Audit events are emitted to SQS for ALL reject decisions (Layer1/2/3 + other rejects)
✅ Hash duplicate (Layer1) now generates an audit record (previously it returned early)
✅ Removed incorrect audit emit from save_to_s3() (it was firing for SAVED items with UNKNOWN fields)
✅ Audit payload schema is consistent with Lambda3 writer
✅ Clear logging for each gate + decision
✅ Bedrock now uses converse() API instead of invoke_model() — fixes ValidationException
✅ Bedrock converse() passes raw bytes (not base64 string) — fixes MIME mismatch (text/plain vs application/pdf)
✅ SHA256 check uses KeyCount instead of "Contents" key — more reliable
✅ NoSuchKey guard now catches ClientError 404 correctly and returns early — prevents crash on stale S3 events
✅ unquote_plus restored for S3 key decoding (handles + in filenames safely)

Last corrected: 2026-02-26
"""

import json
import re
import os
import email
import logging
import hashlib
import urllib3
from email import policy
from datetime import datetime, timezone
from urllib.parse import unquote_plus
from decimal import Decimal

import boto3
from botocore.config import Config
from boto3.dynamodb.conditions import Key, Attr


# -----------------------------
# CONFIGURATION
# -----------------------------
TARGET_PREFIX = os.getenv("TARGET_PREFIX", "email-attachment/")
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "RawEmailMetaData")

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff"}
MAX_ATTACHMENT_BYTES = int(os.getenv("MAX_ATTACHMENT_BYTES", str(4 * 1024 * 1024)))

NOVA_MODEL_ID = os.getenv("NOVA_MODEL_ID", "amazon.nova-lite-v1:0")
BEDROCK_READ_TIMEOUT = int(os.getenv("BEDROCK_READ_TIMEOUT", "60"))

# Workato
WORKATO_WEBHOOK_URL = os.getenv(
    "WORKATO_WEBHOOK_URL",
    "https://apim.workato.com/sheikt0/aws-nova-ai-response-v1/nova-ai-lambda-response"
)
WORKATO_API_TOKEN = os.getenv("WORKATO_API_TOKEN", "")
WORKATO_TIMEOUT = int(os.getenv("WORKATO_TIMEOUT", "30"))

# Layer2 Business Duplicate (Dynamo)
ENABLE_LAYER2_BUSINESS_DUP = os.getenv("ENABLE_LAYER2_BUSINESS_DUP", "false").lower() == "true"
FUSION_TABLE_NAME = os.getenv("FUSION_TABLE_NAME", "FusionInvoicesTable")
BUSINESSKEY_GSI_NAME = os.getenv("BUSINESSKEY_GSI_NAME", "BusinessKey-index")

# ✅ Audit to SQS (for Lambda3)
AUDIT_SQS_URL = os.getenv("AUDIT_SQS_URL", "")
ENABLE_AUDIT_SQS = os.getenv("ENABLE_AUDIT_SQS", "true").lower() == "true"


# -----------------------------
# STANDARD REJECT CODES
# -----------------------------
REJECT_DUPLICATE          = "REJECTED_DUPLICATE"
REJECT_NOT_INVOICE        = "REJECTED_NOTANINVOICE"
REJECT_RISKY              = "REJECTED_RISKY"
REJECT_EXTENSION          = "REJECTED_INVALID_EXTENSION"
REJECT_TOO_LARGE          = "REJECTED_FILE_TOO_LARGE"
REJECT_EMPTY              = "REJECTED_EMPTY_FILE"
REJECT_AI_ERROR           = "REJECTED_AI_ERROR"
REJECT_S3_ERROR           = "REJECTED_S3_ERROR"
REJECT_EMAIL_PARSE        = "REJECTED_EMAIL_PARSE"
REJECT_ERP_DUPLICATE      = "REJECTED_ERP_DUPLICATE"
REJECT_WORKATO_ERROR      = "REJECTED_WORKATO_ERROR"
REJECT_BUSINESS_DUPLICATE = "REJECTED_BUSINESS_DUPLICATE"


# -----------------------------
# AWS CLIENTS
# -----------------------------
s3           = boto3.client("s3")
bedrock      = boto3.client("bedrock-runtime", config=Config(read_timeout=BEDROCK_READ_TIMEOUT))
dynamodb     = boto3.resource("dynamodb")
table        = dynamodb.Table(DYNAMODB_TABLE)
fusion_table = dynamodb.Table(FUSION_TABLE_NAME)
sqs          = boto3.client("sqs")  # ✅ Audit SQS client

http = urllib3.PoolManager(
    timeout=urllib3.Timeout(connect=WORKATO_TIMEOUT, read=WORKATO_TIMEOUT),
    retries=urllib3.Retry(2, backoff_factor=0.5)
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("invoice-audit")


# -----------------------------
# HELPER FUNCTIONS
# -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_filename(name: str) -> str:
    name = os.path.basename(name or "attachment")
    name = re.sub(r"[^\w\d.\-]", "_", name)
    return name[:180]


def sender_domain(sender: str) -> str:
    if not sender:
        return "unknown"
    m = re.search(r"@([A-Za-z0-9\.\-]+\.[A-Za-z]{2,})", sender)
    return m.group(1).lower() if m else "unknown"


def sender_tag(sender: str) -> str:
    d = sender_domain(sender).replace(".", "_")
    return safe_filename(d) or "unknown"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_doc_format(ext: str) -> str:
    x = (ext or "").lower().lstrip(".")
    if x == "jpg":
        return "jpeg"
    if x == "tif":
        return "tiff"
    return x or "pdf"


def float_to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: float_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [float_to_decimal(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(float_to_decimal(item) for item in obj)
    else:
        return obj


def normalize_text(s: str) -> str:
    return (s or "").strip().lower()


def build_business_key(vendor_name: str, invoice_number: str) -> str:
    return f"{normalize_text(vendor_name)}|{normalize_text(invoice_number)}"


# -----------------------------
# ✅ AUDIT EMIT (Best-effort)
# -----------------------------
def emit_audit_best_effort(audit_event: dict):
    """
    Sends audit event to SQS for Lambda3 to write into InvoiceAuditLayer.
    Never breaks pipeline — all errors are swallowed and logged.
    """
    if not ENABLE_AUDIT_SQS:
        return
    if not AUDIT_SQS_URL:
        logger.warning("AUDIT_SQS_URL not set; skipping audit emit.")
        return

    audit_event.setdefault("DetectedAt", now_iso())
    audit_event.setdefault("Decision", "REJECTED")

    try:
        sqs.send_message(
            QueueUrl=AUDIT_SQS_URL,
            MessageBody=json.dumps(audit_event, default=str)
        )
        logger.info(
            f"✅ Audit event emitted. "
            f"Layer={audit_event.get('RejectLayer')} "
            f"Code={audit_event.get('RejectCode')}"
        )
    except Exception as e:
        logger.error(f"❌ Audit emit failed (ignored): {str(e)[:200]}")


# -----------------------------
# LAYER 2: BUSINESS DUPLICATE (FAIL-OPEN)
# -----------------------------
def business_duplicate_exists(business_key: str, invoice_number: str, vendor_name: str) -> bool:
    """
    Layer 2 lookup — FAIL OPEN on any error so Workato is never skipped
    due to an infrastructure issue with DynamoDB/GSI.
    Returns True only when a confirmed duplicate is found.
    Returns False on ANY exception.
    """
    if not business_key:
        return False

    # 1) Try GSI query (fast path)
    try:
        resp = fusion_table.query(
            IndexName=BUSINESSKEY_GSI_NAME,
            KeyConditionExpression=Key("BusinessKey").eq(business_key),
            Limit=1
        )
        if resp.get("Count", 0) > 0:
            logger.info(f"[Layer2] GSI hit for BusinessKey={business_key}")
            return True
    except Exception as e:
        logger.warning(f"[Layer2] GSI query failed, skipping Layer2 (fail-open): {str(e)[:180]}")
        return False  # Fail-open: let Workato handle it

    # 2) Scan fallback (only if GSI returned 0, not on error)
    try:
        resp = fusion_table.scan(
            FilterExpression=Attr("BusinessKey").eq(business_key),
            Limit=1
        )
        if len(resp.get("Items", [])) > 0:
            logger.info(f"[Layer2] Scan hit for BusinessKey={business_key}")
            return True

        inv = (invoice_number or "").strip()
        ven = (vendor_name or "").strip()

        if inv and ven:
            resp2 = fusion_table.scan(
                FilterExpression=(
                    Attr("InvoiceNumber").eq(inv) &
                    (Attr("Supplier").eq(ven) | Attr("VendorName").eq(ven))
                ),
                Limit=1
            )
            return len(resp2.get("Items", [])) > 0

    except Exception as e:
        logger.error(f"[Layer2] Scan fallback failed, skipping Layer2 (fail-open): {str(e)[:180]}")

    return False


# -----------------------------
# NOVA AI CLASSIFICATION & EXTRACTION
# -----------------------------
def extract_invoice_data_with_nova(attachment_bytes: bytes, ext: str) -> dict:
    """
    Uses Bedrock Converse API (correct format for Nova multimodal).
    Fixes: ValidationException 'extraneous key [document] not permitted'
    that occurred when using invoke_model() with the old body format.
    """
    doc_format = normalize_doc_format(ext)

    prompt = (
        "You are analyzing an invoice document for ERP integration.\n\n"
        "Tasks:\n"
        "1. Determine if this is an official Invoice or Credit Memo\n"
        "2. If it is an invoice/credit memo, extract:\n"
        "   - Invoice Number\n"
        "   - Vendor/Supplier Name\n\n"
        "Return ONLY strict JSON:\n"
        "{\n"
        "  \"is_invoice\": boolean,\n"
        "  \"type\": \"Invoice\" | \"Credit Memo\" | \"Other\",\n"
        "  \"invoice_number\": string | null,\n"
        "  \"vendor_name\": string | null,\n"
        "  \"confidence\": float\n"
        "}\n"
        "No markdown. No explanations.\n"
    )

    try:
        # ✅ Converse API requires RAW bytes — NOT base64 encoded string.
        # Passing base64 causes Nova to detect MIME type as text/plain instead of application/pdf.
        response = bedrock.converse(
            modelId=NOVA_MODEL_ID,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "document": {
                            "name": "doc",
                            "format": doc_format,
                            "source": {"bytes": attachment_bytes}  # ✅ raw bytes directly
                        }
                    },
                    {"text": prompt}
                ]
            }],
            inferenceConfig={"temperature": 0.0, "maxTokens": 300}
        )

        res_text = response["output"]["message"]["content"][0]["text"]
        cleaned  = re.sub(r"```json|```", "", (res_text or "")).strip()
        parsed   = json.loads(cleaned)

        is_invoice     = bool(parsed.get("is_invoice", False))
        doc_type       = str(parsed.get("type", "Other"))[:40]
        invoice_number = parsed.get("invoice_number")
        vendor_name    = parsed.get("vendor_name")
        confidence     = float(parsed.get("confidence", 0.0))

        if invoice_number:
            invoice_number = str(invoice_number).strip()[:100]
        if vendor_name:
            vendor_name = str(vendor_name).strip()[:200]

        return {
            "ok":             True,
            "is_invoice":     is_invoice,
            "type":           doc_type,
            "invoice_number": invoice_number,
            "vendor_name":    vendor_name,
            "confidence":     confidence
        }

    except Exception as e:
        logger.error(f"Nova extraction failed: {str(e)}")
        return {
            "ok":             False,
            "is_invoice":     False,
            "type":           "Error",
            "invoice_number": None,
            "vendor_name":    None,
            "confidence":     0.0,
            "error":          str(e)[:400]
        }


# -----------------------------
# WORKATO ERP DUPLICATE CHECK
# -----------------------------
def check_with_workato(invoice_number: str, vendor_name: str, attachment_metadata: dict) -> dict:
    if not invoice_number or not vendor_name:
        logger.warning("Missing invoice number or vendor name for Workato check")
        return {
            "is_duplicate":    False,
            "count":           0,
            "should_proceed":  True,
            "workato_response": {},
            "message":         "Missing data for duplicate check"
        }

    payload = {
        "invoice_number": invoice_number,
        "vendor_name":    vendor_name,
        "source":         "aws_lambda_invoice_processor",
        "timestamp":      now_iso(),
        "attachment_info": {
            "filename":   attachment_metadata.get("filename"),
            "size_bytes": attachment_metadata.get("sizeBytes"),
            "sha256":     attachment_metadata.get("sha256")
        }
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent":   "AWS-Lambda-Invoice-Processor",
        "Accept":       "application/json",
        "API-Token":    WORKATO_API_TOKEN
    }

    logger.info(f"[Workato] Calling ERP duplicate check for invoice={invoice_number}, vendor={vendor_name}")

    try:
        encoded_payload = json.dumps(payload).encode("utf-8")
        response = http.request("POST", WORKATO_WEBHOOK_URL, body=encoded_payload, headers=headers)

        logger.info(f"[Workato] Response status: {response.status}")

        if response.status >= 400:
            error_body = response.data.decode("utf-8") if response.data else "No body"
            logger.error(f"[Workato] HTTP error {response.status}: {error_body[:200]}")
            return {
                "is_duplicate":    False,
                "count":           0,
                "should_proceed":  True,
                "workato_response": {},
                "error":           f"http_{response.status}",
                "message":         f"Workato status {response.status}: {error_body[:100]}"
            }

        response_data    = response.data.decode("utf-8") if response.data else "{}"
        workato_response = json.loads(response_data) if response_data else {}

        logger.info(f"[Workato] Response body: {str(workato_response)[:300]}")

        count = 0
        if isinstance(workato_response, dict):
            count = int(workato_response.get("count", 0))
        elif isinstance(workato_response, list):
            count = len(workato_response)

        is_duplicate = count > 0

        return {
            "is_duplicate":    is_duplicate,
            "count":           count,
            "should_proceed":  not is_duplicate,
            "workato_response": workato_response,
            "message":         f"Found {count} matching invoice(s)."
        }

    except Exception as e:
        logger.error(f"Workato check error: {str(e)}")
        return {
            "is_duplicate":    False,
            "count":           0,
            "should_proceed":  True,
            "workato_response": {},
            "error":           "internal_error",
            "message":         f"Workato error: {str(e)[:120]}"
        }


# -----------------------------
# S3 SAVE FUNCTION
# -----------------------------
def save_to_s3(
    data: bytes,
    filename: str,
    ai_result: dict,
    workato_result: dict,
    message_id: str,
    bucket: str,
    sender: str,
    business_key: str,
) -> str:
    safe_vendor  = re.sub(r"[^\w\d]", "_", (ai_result.get("vendor_name") or "unknown")[:30])
    safe_invoice = re.sub(r"[^\w\d]", "_", (ai_result.get("invoice_number") or "noinv")[:20])
    safe_sender  = sender_tag(sender)
    date_tag     = datetime.now().strftime("%d%b%y")

    dest = f"{TARGET_PREFIX}{safe_vendor}_{safe_invoice}/{date_tag}_{safe_sender}_{filename}"

    metadata = {
        "MessageID":      str(message_id)[:200],
        "InvoiceNumber":  (ai_result.get("invoice_number") or "unknown")[:100],
        "VendorName":     (ai_result.get("vendor_name") or "unknown")[:100],
        "BusinessKey":    (business_key or "")[:200],
        "DocumentType":   ai_result.get("type", "Unknown")[:40],
        "AIConfidence":   str(ai_result.get("confidence", 0)),
        "ProcessedDate":  now_iso(),
        "WorkatoChecked": "true",
        "WorkatoCount":   str(workato_result.get("count", 0)),
        "Sender":         safe_sender[:50],
    }

    s3.put_object(Bucket=bucket, Key=dest, Body=data, Metadata=metadata)
    logger.info(f"✅ File saved to S3: s3://{bucket}/{dest}")
    return dest


# -----------------------------
# ATTACHMENT PROCESSOR
# -----------------------------
def process_attachment(
    data: bytes,
    filename: str,
    ext: str,
    sender: str,
    message_id: str,
    bucket: str
) -> dict:

    file_hash = sha256_hex(data)

    entry = {
        "file":         filename,
        "sizeBytes":    len(data),
        "sha256":       file_hash,
        "status":       None,
        "rejectCode":   None,
        "rejectReason": None,
        "businessKey":  None,
        "s3":           None
    }

    # -------------------------------------------------------
    # Gate 1: Extension Check
    # -------------------------------------------------------
    if ext not in ALLOWED_EXTENSIONS:
        entry["status"]       = "REJECTED"
        entry["rejectCode"]   = REJECT_EXTENSION
        entry["rejectReason"] = f"Unsupported extension: {ext}"

        emit_audit_best_effort({
            "Decision":       "REJECTED",
            "RejectLayer":    "GATE_EXTENSION",
            "RejectCode":     entry["rejectCode"],
            "RejectReason":   entry["rejectReason"],
            "DocumentHash":   file_hash,
            "SourceFileName": filename,
            "MessageID":      message_id,
            "Sender":         sender,
        })
        return entry

    # -------------------------------------------------------
    # Gate 2: File Size Check
    # -------------------------------------------------------
    if len(data) > MAX_ATTACHMENT_BYTES:
        entry["status"]       = "REJECTED"
        entry["rejectCode"]   = REJECT_TOO_LARGE
        entry["rejectReason"] = f"File exceeds limit {MAX_ATTACHMENT_BYTES} bytes"

        emit_audit_best_effort({
            "Decision":       "REJECTED",
            "RejectLayer":    "GATE_SIZE",
            "RejectCode":     entry["rejectCode"],
            "RejectReason":   entry["rejectReason"],
            "DocumentHash":   file_hash,
            "SourceFileName": filename,
            "MessageID":      message_id,
            "Sender":         sender,
        })
        return entry

    # -------------------------------------------------------
    # Gate 3: SHA256 Duplicate Check (file-level, Layer 1)
    # -------------------------------------------------------
    hash_prefix = f"{TARGET_PREFIX}by-hash/{file_hash}/"
    try:
        resp = s3.list_objects_v2(Bucket=bucket, Prefix=hash_prefix, MaxKeys=1)
        if resp.get("KeyCount", 0) > 0:  # ✅ More reliable than checking "Contents"
            entry["status"]       = "REJECTED"
            entry["rejectCode"]   = REJECT_DUPLICATE
            entry["rejectReason"] = "Duplicate detected using SHA256 hash"

            # ✅ FIX: Emit audit for Layer 1 hash duplicate BEFORE returning
            emit_audit_best_effort({
                "Decision":       "REJECTED",
                "RejectLayer":    "LAYER1_HASH_DUPLICATE",
                "RejectCode":     entry["rejectCode"],
                "RejectReason":   entry["rejectReason"],
                "DocumentHash":   file_hash,
                "SourceFileName": filename,
                "MessageID":      message_id,
                "Sender":         sender,
            })
            return entry
    except Exception as e:
        logger.warning(f"S3 list failed for hash check (continuing): {str(e)[:180]}")

    # -------------------------------------------------------
    # Gate 4: Nova AI Classification & Extraction
    # -------------------------------------------------------
    ai_result = extract_invoice_data_with_nova(data, ext)

    if not ai_result.get("ok"):
        entry["status"]       = "REJECTED"
        entry["rejectCode"]   = REJECT_AI_ERROR
        entry["rejectReason"] = f"Nova failed: {ai_result.get('error', 'unknown')}"
        entry["ai_result"]    = ai_result

        emit_audit_best_effort({
            "Decision":       "REJECTED",
            "RejectLayer":    "GATE_AI",
            "RejectCode":     entry["rejectCode"],
            "RejectReason":   entry["rejectReason"],
            "DocumentHash":   file_hash,
            "SourceFileName": filename,
            "MessageID":      message_id,
            "Sender":         sender,
        })
        return entry

    entry["docType"]                  = ai_result.get("type")
    entry["ai_confidence"]            = ai_result.get("confidence")
    entry["extracted_invoice_number"] = ai_result.get("invoice_number")
    entry["extracted_vendor_name"]    = ai_result.get("vendor_name")
    entry["ai_result"]                = ai_result

    if not ai_result.get("is_invoice"):
        entry["status"]       = "REJECTED"
        entry["rejectCode"]   = REJECT_NOT_INVOICE
        entry["rejectReason"] = f"Nova classified as {ai_result.get('type', 'Other')}"

        emit_audit_best_effort({
            "Decision":       "REJECTED",
            "RejectLayer":    "GATE_NOT_INVOICE",
            "RejectCode":     entry["rejectCode"],
            "RejectReason":   entry["rejectReason"],
            "InvoiceNumber":  ai_result.get("invoice_number"),
            "Supplier":       ai_result.get("vendor_name"),
            "DocumentHash":   file_hash,
            "SourceFileName": filename,
            "MessageID":      message_id,
            "Sender":         sender,
            "Confidence":     ai_result.get("confidence", 0.0),
        })
        return entry

    # -------------------------------------------------------
    # Missing Fields: Save as FLAGGED, skip Workato
    # -------------------------------------------------------
    if not ai_result.get("invoice_number") or not ai_result.get("vendor_name"):
        entry["status"]       = "FLAGGED"
        entry["rejectCode"]   = "FLAGGED_MISSING_FIELDS"
        entry["rejectReason"] = "Missing invoice number or vendor name"
        logger.warning(f"[Workato] Skipping Workato — missing invoice_number or vendor_name for {filename}")

        emit_audit_best_effort({
            "Decision":       "REJECTED",
            "RejectLayer":    "GATE_MISSING_FIELDS",
            "RejectCode":     entry["rejectCode"],
            "RejectReason":   entry["rejectReason"],
            "DocumentHash":   file_hash,
            "SourceFileName": filename,
            "MessageID":      message_id,
            "Sender":         sender,
            "Confidence":     ai_result.get("confidence", 0.0),
        })

        try:
            dest = save_to_s3(
                data=data,
                filename=filename,
                ai_result=ai_result,
                workato_result={"count": 0, "is_duplicate": False},
                message_id=message_id,
                bucket=bucket,
                sender=sender,
                business_key=""
            )
            entry["s3"]     = dest
            entry["status"] = "SAVED_FLAGGED"
        except Exception as e:
            entry["status"]       = "REJECTED"
            entry["rejectCode"]   = REJECT_S3_ERROR
            entry["rejectReason"] = f"S3 save failed: {str(e)[:160]}"

            emit_audit_best_effort({
                "Decision":       "REJECTED",
                "RejectLayer":    "GATE_S3_ERROR",
                "RejectCode":     entry["rejectCode"],
                "RejectReason":   entry["rejectReason"],
                "DocumentHash":   file_hash,
                "SourceFileName": filename,
                "MessageID":      message_id,
                "Sender":         sender,
            })

        return entry

    # -------------------------------------------------------
    # Gate 4.5: Layer 2 Business Duplicate Check (our DB)
    # -------------------------------------------------------
    business_key         = build_business_key(ai_result["vendor_name"], ai_result["invoice_number"])
    entry["businessKey"] = business_key

    if ENABLE_LAYER2_BUSINESS_DUP:
        logger.info(f"[Layer2] Checking BusinessKey={business_key}")
        is_biz_dup = business_duplicate_exists(
            business_key, ai_result["invoice_number"], ai_result["vendor_name"]
        )
        if is_biz_dup:
            entry["status"]       = "REJECTED"
            entry["rejectCode"]   = REJECT_BUSINESS_DUPLICATE
            entry["rejectReason"] = (
                "Duplicate detected using BusinessKey (vendor+invoice_number) "
                "in FusionInvoicesTable"
            )
            logger.info("[Layer2] Blocked as business duplicate — Workato skipped")

            emit_audit_best_effort({
                "Decision":       "REJECTED",
                "RejectLayer":    "LAYER2_BUSINESSKEY",
                "RejectCode":     entry["rejectCode"],
                "RejectReason":   entry["rejectReason"],
                "InvoiceNumber":  ai_result.get("invoice_number"),
                "Supplier":       ai_result.get("vendor_name"),
                "BusinessKey":    business_key,
                "DocumentHash":   file_hash,
                "SourceFileName": filename,
                "MessageID":      message_id,
                "Sender":         sender,
                "Confidence":     ai_result.get("confidence", 0.0),
            })
            return entry
        else:
            logger.info("[Layer2] No business duplicate found, proceeding to Workato")
    else:
        logger.info("[Layer2] ENABLE_LAYER2_BUSINESS_DUP=false — skipping Layer2, proceeding to Workato")

    # -------------------------------------------------------
    # Gate 5: Workato ERP Duplicate Check (Layer 3)
    # -------------------------------------------------------
    attachment_metadata = {"filename": filename, "sizeBytes": len(data), "sha256": file_hash}

    workato_result = check_with_workato(
        invoice_number=ai_result["invoice_number"],
        vendor_name=ai_result["vendor_name"],
        attachment_metadata=attachment_metadata
    )

    entry["workato_result"] = {
        "count":        workato_result.get("count", 0),
        "is_duplicate": workato_result.get("is_duplicate", False),
        "message":      workato_result.get("message", ""),
        "timestamp":    now_iso()
    }

    if workato_result.get("is_duplicate", False):
        entry["status"]       = "REJECTED"
        entry["rejectCode"]   = REJECT_ERP_DUPLICATE
        entry["rejectReason"] = (
            f"Workato found {workato_result.get('count', 0)} existing invoice(s) "
            f"with #{ai_result['invoice_number']} from {ai_result['vendor_name']}"
        )

        emit_audit_best_effort({
            "Decision":        "REJECTED",
            "RejectLayer":     "LAYER3_ERP",
            "RejectCode":      entry["rejectCode"],
            "RejectReason":    entry["rejectReason"],
            "InvoiceNumber":   ai_result.get("invoice_number"),
            "Supplier":        ai_result.get("vendor_name"),
            "SupplierSite":    "",
            "InvoiceAmount":   "",
            "InvoiceCurrency": "",
            "DocumentHash":    file_hash,
            "BusinessKey":     business_key,
            "SourceFileName":  filename,
            "MessageID":       message_id,
            "Sender":          sender,
            "Confidence":      ai_result.get("confidence", 0.0),
        })
        return entry

    # Workato error: do not block, just warn
    if workato_result.get("error"):
        entry["status"]  = "SAVED_WITH_WARNING"
        entry["warning"] = f"Workato error: {workato_result.get('message')}"
    else:
        entry["status"] = "SAVED"

    # -------------------------------------------------------
    # Save to S3
    # -------------------------------------------------------
    try:
        dest = save_to_s3(
            data=data,
            filename=filename,
            ai_result=ai_result,
            workato_result=workato_result,
            message_id=message_id,
            bucket=bucket,
            sender=sender,
            business_key=business_key
        )
        entry["s3"] = dest
    except Exception as e:
        entry["status"]       = "REJECTED"
        entry["rejectCode"]   = REJECT_S3_ERROR
        entry["rejectReason"] = f"S3 save failed: {str(e)[:160]}"

        emit_audit_best_effort({
            "Decision":       "REJECTED",
            "RejectLayer":    "GATE_S3_ERROR",
            "RejectCode":     entry["rejectCode"],
            "RejectReason":   entry["rejectReason"],
            "InvoiceNumber":  ai_result.get("invoice_number"),
            "Supplier":       ai_result.get("vendor_name"),
            "BusinessKey":    business_key,
            "DocumentHash":   file_hash,
            "SourceFileName": filename,
            "MessageID":      message_id,
            "Sender":         sender,
        })

    return entry


# -----------------------------
# MAIN PROCESSOR
# -----------------------------
def process_record(record: dict):
    bucket = record["s3"]["bucket"]["name"]
    key    = unquote_plus(record["s3"]["object"]["key"])  # ✅ unquote_plus handles + in filenames

    # Avoid re-processing already-saved attachment objects
    if key.startswith(TARGET_PREFIX):
        logger.info(f"Skipping already processed object: s3://{bucket}/{key}")
        return {"message_id": key, "final_status": "SKIPPED_ALREADY_PROCESSED", "workato_summary": []}

    received_date = now_iso()

    # -------------------------------------------------------
    # ✅ FIX: Guard against NoSuchKey — S3 event can fire for
    # keys that no longer exist (deleted/moved before Lambda ran).
    # head_object returns a ClientError with 404, NOT s3.exceptions.NoSuchKey,
    # so we must inspect the error code explicitly.
    # -------------------------------------------------------
    try:
        s3.head_object(Bucket=bucket, Key=key)
    except Exception as e:
        error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        http_status = getattr(e, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode", 0)

        if error_code in ("NoSuchKey", "404") or http_status == 404:
            logger.error(
                f"[NoSuchKey] Object no longer exists: s3://{bucket}/{key}. "
                f"It may have been moved or deleted before Lambda ran. Skipping."
            )
            return {"message_id": key, "final_status": "SKIPPED_KEY_NOT_FOUND", "workato_summary": []}
        else:
            # Unexpected error (e.g. permissions) — log and attempt get_object anyway
            logger.warning(f"[head_object] Unexpected error ({error_code}): {str(e)[:200]}")

    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        msg = email.message_from_bytes(obj["Body"].read(), policy=policy.default)
    except Exception as e:
        fallback_id = key
        table.put_item(Item={
            "MessageID":    fallback_id,
            "ReceivedDate": received_date,
            "Sender":       "Unknown",
            "Subject":      "Unknown",
            "S3RawPath":    f"s3://{bucket}/{key}",
            "Status":       "FAILED_EMAIL_PARSE",
            "LastUpdated":  now_iso(),
            "Attachments":  [],
            "Error":        f"{REJECT_EMAIL_PARSE}: {str(e)[:300]}"
        })
        logger.exception(f"Failed to parse email: s3://{bucket}/{key}")
        return

    message_id = msg.get("Message-ID", key)
    sender     = msg.get("From", "Unknown")
    subject    = msg.get("Subject", "No Subject")

    table.put_item(Item={
        "MessageID":    message_id,
        "ReceivedDate": received_date,
        "Sender":       sender,
        "Subject":      subject,
        "S3RawPath":    f"s3://{bucket}/{key}",
        "Status":       "PROCESSING",
        "LastUpdated":  now_iso()
    })

    audit = []

    for part in msg.walk():
        filename = part.get_filename()
        if not filename:
            continue

        filename = safe_filename(filename)
        ext      = os.path.splitext(filename)[1].lower()

        data = part.get_payload(decode=True)
        if not data:
            entry = {
                "file":         filename,
                "status":       "REJECTED",
                "rejectCode":   REJECT_EMPTY,
                "rejectReason": "Attachment is empty or decode failed"
            }
            audit.append(entry)

            emit_audit_best_effort({
                "Decision":       "REJECTED",
                "RejectLayer":    "GATE_EMPTY",
                "RejectCode":     entry["rejectCode"],
                "RejectReason":   entry["rejectReason"],
                "SourceFileName": filename,
                "MessageID":      message_id,
                "Sender":         sender,
            })
            continue

        entry = process_attachment(
            data=data,
            filename=filename,
            ext=ext,
            sender=sender,
            message_id=message_id,
            bucket=bucket
        )
        audit.append(entry)

    saved_count    = sum(1 for a in audit if a.get("status") in ["SAVED", "SAVED_FLAGGED", "SAVED_WITH_WARNING"])
    rejected_count = sum(1 for a in audit if a.get("status") == "REJECTED")

    if len(audit) == 0:
        final_status = "SKIPPED_NO_ATTACHMENTS"
    elif saved_count == 0:
        final_status = "SKIPPED_ALL_REJECTED"
    elif saved_count > 0 and rejected_count > 0:
        final_status = "PARTIAL_COMPLETED"
    else:
        final_status = "COMPLETED"

    saved_attachments = [a for a in audit if a.get("status") in ["SAVED", "SAVED_FLAGGED", "SAVED_WITH_WARNING"]]
    invoice_number = None
    vendor_name    = None
    business_key   = None
    if saved_attachments:
        first_saved    = saved_attachments[0]
        invoice_number = first_saved.get("extracted_invoice_number")
        vendor_name    = first_saved.get("extracted_vendor_name")
        business_key   = first_saved.get("businessKey")

    audit_decimal = float_to_decimal(audit)

    update_expression = "SET Attachments=:a, #st=:s, ProcessedAt=:p, LastUpdated=:lu"
    expression_values = {
        ":a":  audit_decimal,
        ":s":  final_status,
        ":p":  now_iso(),
        ":lu": now_iso()
    }
    expression_names = {"#st": "Status"}

    if invoice_number:
        update_expression += ", InvoiceNumber=:inv"
        expression_values[":inv"] = invoice_number
    if vendor_name:
        update_expression += ", VendorName=:ven"
        expression_values[":ven"] = vendor_name
    if business_key:
        update_expression += ", BusinessKey=:bk"
        expression_values[":bk"] = business_key

    try:
        table.update_item(
            Key={"MessageID": message_id, "ReceivedDate": received_date},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values
        )
        logger.info(f"✅ DynamoDB updated → {message_id} | Status: {final_status}")
    except Exception as e:
        logger.error(f"Failed to update DynamoDB: {str(e)[:200]}")

    logger.info(f"✅ Processing complete → {message_id} | Final Status: {final_status}")

    # Build Workato summary for response
    workato_summary = []
    for a in audit:
        wr = a.get("workato_result")
        workato_summary.append({
            "file":            a.get("file"),
            "status":          a.get("status"),
            "rejectCode":      a.get("rejectCode"),
            "invoice_number":  a.get("extracted_invoice_number"),
            "vendor_name":     a.get("extracted_vendor_name"),
            "workato_called":  wr is not None,
            "workato_status":  (
                "duplicate" if (wr or {}).get("is_duplicate")
                else "error" if (wr or {}).get("error")
                else "ok" if wr
                else "skipped"
            ),
            "workato_count":   (wr or {}).get("count", 0),
            "workato_message": (wr or {}).get("message", ""),
            "workato_error":   (wr or {}).get("error"),
        })

    return {
        "message_id":      message_id,
        "final_status":    final_status,
        "workato_summary": workato_summary
    }


# -----------------------------
# LAMBDA HANDLER
# -----------------------------
def lambda_handler(event, context):
    logger.info(f"Received event with {len(event.get('Records', []))} record(s)")
    records = event.get("Records", [])

    results = []
    for record in records:
        try:
            result = process_record(record)
            if result:
                results.append(result)
        except Exception as e:
            logger.exception(f"Critical failure processing record: {str(e)[:200]}")
            results.append({"error": str(e)})

    response_body = {
        "message":           "Processing complete",
        "processed_records": len(records),
        "results":           results
    }

    logger.info(f"Lambda response: {json.dumps(response_body, default=str)}")

    return {
        "statusCode": 200,
        "body": json.dumps(response_body, default=str)
    }