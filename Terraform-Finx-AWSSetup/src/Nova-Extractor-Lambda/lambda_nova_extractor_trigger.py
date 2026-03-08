"""
Lambda 2: Invoice Extractor + DynamoDB Insert + Workato Trigger (FINAL)
------------------------------------------------------------------------------------------
All fixes applied:
✅ Bedrock converse() passes RAW BYTES — fixes MIME mismatch (text/plain vs application/pdf)
✅ LegalEntity always set to "" — Nova no longer guesses it from supplier name
✅ Supplier / SupplierSite prompt clarified — Nova extracts exactly as printed on invoice
✅ BusinessUnit extracted from invoice, empty string if not found
✅ InvoiceType / InvoiceGroup default to "Standard" if not found
✅ invoiceLines: prompt scans EVERY line item explicitly
✅ invoiceLines: AccountingDate + TaxControlAmount required on every line
✅ invoiceLines: Fallback line created from header amount if Nova returns empty array
✅ invoiceLines: Repair loop patches any missing fields per line
✅ base64_file used only for Workato attachment — NOT passed to Bedrock
✅ Duplicate check is fail-open (GSI first, scan fallback, never blocks pipeline)

Required Lambda Environment Variables:
- TABLE_NAME            : DynamoDB table name (default: FusionInvoicesTable)
- WORKATO_WEBHOOK_URL   : Workato webhook endpoint
- WORKATO_API_TOKEN     : Workato API token (optional)
- MODEL_ID              : Bedrock model (default: amazon.nova-lite-v1:0)
- AUDIT_SQS_URL         : SQS queue URL for audit events
- ENABLE_IDEMPOTENCY    : true/false (default: true)
- INVOICE_GSI_NAME      : GSI name for duplicate check (optional)
- ENABLE_SCAN_FALLBACK  : true/false — scan if GSI missing (default: true)
- APP_NAME              : audit tag (default: AppSys-inVi)
- ENV                   : audit tag (default: dev)
"""

import boto3
import json
import os
import urllib3
import base64
import uuid
import hashlib
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr


# -----------------------------
# AWS Clients
# -----------------------------
s3       = boto3.client("s3")
bedrock  = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "us-east-1"))
dynamodb = boto3.resource("dynamodb")
sqs      = boto3.client("sqs")
http     = urllib3.PoolManager(
    timeout=urllib3.Timeout(connect=20.0, read=60.0),
    retries=urllib3.Retry(2, backoff_factor=0.5),
)


# -----------------------------
# Configuration
# -----------------------------
TABLE_NAME          = os.getenv("TABLE_NAME", "FusionInvoicesTable")
WORKATO_WEBHOOK_URL = os.getenv(
    "WORKATO_WEBHOOK_URL",
    "https://webhooks.workato.com/webhooks/rest/a2b0ea68-5acb-4ed5-8817-980d5f4d487b/lambdatigger"
)
WORKATO_API_TOKEN    = os.getenv("WORKATO_API_TOKEN", "")
MODEL_ID             = os.getenv("MODEL_ID", "amazon.nova-lite-v1:0")
ENABLE_IDEMPOTENCY   = os.getenv("ENABLE_IDEMPOTENCY", "true").lower() == "true"
AUDIT_SQS_URL        = os.getenv("AUDIT_SQS_URL", "")
APP_NAME             = os.getenv("APP_NAME", "AppSys-inVi")
ENV                  = os.getenv("ENV", "dev")
INVOICE_GSI_NAME     = os.getenv("INVOICE_GSI_NAME", "")
ENABLE_SCAN_FALLBACK = os.getenv("ENABLE_SCAN_FALLBACK", "true").lower() == "true"

table = dynamodb.Table(TABLE_NAME)


# -----------------------------
# Helpers
# -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def format_numbers(obj):
    """Recursively converts floats to Decimals for DynamoDB compatibility."""
    if isinstance(obj, list):
        return [format_numbers(i) for i in obj]
    if isinstance(obj, dict):
        return {k: format_numbers(v) for k, v in obj.items()}
    if isinstance(obj, float):
        return Decimal(str(obj))
    return obj


def clean_nova_json(raw_text: str) -> str:
    """Strips markdown code fences and isolates JSON object."""
    txt = (raw_text or "").strip()

    if "```" in txt:
        txt = txt.replace("```json", "```")
        parts = txt.split("```")
        if len(parts) >= 3:
            txt = parts[1].strip()
        else:
            txt = txt.replace("```", "").strip()

    first_brace = txt.find("{")
    last_brace  = txt.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        txt = txt[first_brace:last_brace + 1].strip()

    return txt


def doc_format_from_filename(file_name: str) -> str:
    ext = (file_name.split(".")[-1] if "." in file_name else "").lower()
    if ext in ("jpg", "jpeg"):
        return "jpeg"
    if ext in ("tif", "tiff"):
        return "tiff"
    if ext in ("png", "pdf"):
        return ext
    return "pdf"


# -----------------------------
# Audit Emit (Best-effort)
# -----------------------------
def emit_audit_event_best_effort(payload: dict):
    if not AUDIT_SQS_URL:
        print("AUDIT_SQS_URL not set. Skipping audit emit.")
        return

    payload.setdefault("schemaVersion", "1.0")
    payload.setdefault("eventId",   str(uuid.uuid4()))
    payload.setdefault("emittedAt", now_iso())
    payload.setdefault("app",       APP_NAME)
    payload.setdefault("env",       ENV)

    try:
        sqs.send_message(
            QueueUrl=AUDIT_SQS_URL,
            MessageBody=json.dumps(payload, default=str)
        )
        print(f"[AUDIT] Emitted to SQS. eventId={payload.get('eventId')}")
    except Exception as e:
        print(f"[AUDIT] Failed to emit to SQS (ignored): {str(e)[:300]}")


def get_raw_email_pointers_from_s3_metadata(bucket_name: str, file_key: str) -> dict:
    """
    Reads S3 object metadata if present.
    Lambda1 stores MessageID, VendorName, Sender etc. in S3 object metadata.
    """
    try:
        head = s3.head_object(Bucket=bucket_name, Key=file_key)
        meta = head.get("Metadata", {}) or {}
        return {
            "raw_bucket": meta.get("raw_bucket", ""),
            "raw_key":    meta.get("raw_key", ""),
            "message_id": meta.get("messageid", meta.get("message_id", "")),
            "sender":     meta.get("sender", ""),
            "subject":    meta.get("subject", ""),
        }
    except Exception as e:
        print(f"[AUDIT] head_object metadata read failed (ignored): {str(e)[:200]}")
        return {"raw_bucket": "", "raw_key": "", "message_id": "", "sender": "", "subject": ""}


# -----------------------------
# Duplicate Check (Schema-safe, Fail-open)
# -----------------------------
def invoice_already_exists(inv_no: str) -> bool:
    """
    Best-effort duplicate detection — fail-open on any error.
    1) GSI query if INVOICE_GSI_NAME is set (recommended for production)
    2) Scan fallback if ENABLE_SCAN_FALLBACK=true (demo/dev only)
    """
    if not inv_no:
        return False

    inv_no = str(inv_no).strip()
    if not inv_no:
        return False

    # 1) GSI query path
    if INVOICE_GSI_NAME:
        try:
            resp = table.query(
                IndexName=INVOICE_GSI_NAME,
                KeyConditionExpression=Key("InvoiceNumber").eq(inv_no),
                Limit=1
            )
            return resp.get("Count", 0) > 0
        except Exception as e:
            print(f"[IDEMPOTENCY] GSI query failed (ignored): {str(e)[:200]}")

    # 2) Scan fallback
    if ENABLE_SCAN_FALLBACK:
        try:
            resp = table.scan(
                FilterExpression=Attr("InvoiceNumber").eq(inv_no),
                Limit=1
            )
            return len(resp.get("Items", [])) > 0
        except Exception as e:
            print(f"[IDEMPOTENCY] Scan failed (ignored): {str(e)[:200]}")

    # Fail-open — let it proceed if checks fail
    return False


# -----------------------------
# Main Handler
# -----------------------------
def lambda_handler(event, context):
    try:
        record      = event["Records"][0]
        bucket_name = record["s3"]["bucket"]["name"]
        file_key    = record["s3"]["object"]["key"]
        file_name   = file_key.split("/")[-1]

        # Read S3 metadata for audit trail enrichment
        raw_meta = get_raw_email_pointers_from_s3_metadata(bucket_name, file_key)

        # Download file bytes from S3
        file_obj     = s3.get_object(Bucket=bucket_name, Key=file_key)
        file_content = file_obj["Body"].read()   # raw bytes

        # Hash computed from actual file bytes
        document_hash = sha256_hex(file_content)

        # base64 only used for Workato attachment payload — NOT for Bedrock
        base64_file = base64.b64encode(file_content).decode("utf-8")

        # Document format derived from filename extension
        doc_format = doc_format_from_filename(file_name)

        prompt = """
[Role]: High-accuracy Financial Data Extractor.
[Task]: Convert the attached invoice into a valid JSON object for Oracle Fusion.
[Instructions]:
- Extract 'InvoiceNumber', 'InvoiceCurrency', 'InvoiceAmount', 'InvoiceDate' and 'Description' directly from the invoice document.
- 'Supplier' is the vendor/company name printed on the invoice e.g. "Lee Supplies". Extract exactly as printed.
- 'SupplierSite' is the supplier site or Bill to or Ship to if shown, otherwise use the same value as Supplier.
- 'BusinessUnit' is the buying organisation's business unit if shown on the invoice, otherwise use "".
- 'LegalEntity' set to "" always — do not guess or infer this field.
- 'InvoiceType' set to 'Standard'.
- 'InvoiceGroup' set to 'Standard'.
- Map ALL line items into 'invoiceLines' array. Each line MUST have: LineNumber, LineType (Item), LineAmount, AccountingDate (same as InvoiceDate), TaxControlAmount (0 if not shown), and Description.
- invoiceLines MUST contain at least 1 entry — if no itemised lines found, create 1 line with LineAmount equal to InvoiceAmount.
- All amounts must be numbers not strings.
- Return ONLY raw JSON. Do not include markdown or explanations.
[JSON Schema]:
{
  "InvoiceNumber": "string",
  "InvoiceCurrency": "string",
  "InvoiceAmount": number,
  "InvoiceType": "Standard",
  "InvoiceDate": "YYYY-MM-DD",
  "BusinessUnit": "string",
  "LegalEntity": "",
  "InvoiceGroup": "Standard",
  "Supplier": "string",
  "SupplierSite": "string",
  "Description": "string",
  "invoiceLines": [
    {
      "LineNumber": integer,
      "LineType": "Item",
      "LineAmount": number,
      "AccountingDate": "YYYY-MM-DD",
      "TaxControlAmount": 0,
      "Description": "string"
    }
  ]
}
"""

        # ✅ FIX: Pass raw bytes directly to Bedrock Converse.
        # The boto3 SDK serialises to base64 internally.
        # Passing a base64 string causes Nova to detect MIME as text/plain → ValidationException.
        response = bedrock.converse(
            modelId=MODEL_ID,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "document": {
                            "name":   "Invoice",
                            "format": doc_format,
                            "source": {"bytes": file_content}   # ✅ raw bytes — NOT base64
                        }
                    },
                    {"text": prompt}
                ]
            }],
            inferenceConfig={"temperature": 0}
        )

        raw_text = response["output"]["message"]["content"][0]["text"]
        cleaned  = clean_nova_json(raw_text)

        try:
            invoice_data = json.loads(cleaned)
        except Exception as je:
            raise Exception(
                f"Nova returned non-JSON. "
                f"parse_error={str(je)[:160]} "
                f"cleaned={cleaned[:300]}"
            )

        inv_no = invoice_data.get("InvoiceNumber")
        print(f"[Nova] Extracted InvoiceNumber={inv_no}, Supplier={invoice_data.get('Supplier')}")

        # -------------------------------------------------------
        # Idempotency / Duplicate Check
        # -------------------------------------------------------
        if ENABLE_IDEMPOTENCY and invoice_already_exists(inv_no):
            print(f"[IDEMPOTENT] Invoice {inv_no} already exists. Skipping DynamoDB + Workato.")

            emit_audit_event_best_effort({
                "Decision":        "REJECTED",
                "RejectLayer":     "LAYER2_INVOICE_TABLE",
                "RejectCode":      "REJECTED_DUPLICATE_INVOICENUMBER",
                "RejectReason":    f"InvoiceNumber already exists in {TABLE_NAME}",
                "DetectedAt":      now_iso(),
                "InvoiceNumber":   inv_no,
                "Supplier":        invoice_data.get("Supplier", ""),
                "SupplierSite":    invoice_data.get("SupplierSite", ""),
                "InvoiceAmount":   str(invoice_data.get("InvoiceAmount", "")),
                "InvoiceCurrency": invoice_data.get("InvoiceCurrency", ""),
                "DocumentHash":    document_hash,
                "SourceFileName":  file_name,
                "SilverS3Path":    f"s3://{bucket_name}/{file_key}",
                "RawEmailS3Path":  (
                    f"s3://{raw_meta['raw_bucket']}/{raw_meta['raw_key']}"
                    if raw_meta.get("raw_bucket") and raw_meta.get("raw_key") else ""
                ),
                "MessageID":       raw_meta.get("message_id", ""),
                "Sender":          raw_meta.get("sender", ""),
                "Subject":         raw_meta.get("subject", ""),
            })

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": "Skipped (duplicate InvoiceNumber)",
                    "invoice": inv_no
                })
            }

        # -------------------------------------------------------
        # Enrich invoice data
        # -------------------------------------------------------
        invoice_data["S3_Location"]       = f"s3://{bucket_name}/{file_key}"
        invoice_data["ProcessingStatus"]  = "Dynamo-Inserted"
        invoice_data["ProcessedAt"]       = now_iso()
        invoice_data["SourceFileName"]    = file_name
        invoice_data["DocumentHash"]      = document_hash

        # Oracle Fusion fields — extracted by Nova, fallback to Standard only for type fields
        invoice_data["InvoiceType"]  = invoice_data.get("InvoiceType")  or "Standard"
        invoice_data["InvoiceGroup"] = invoice_data.get("InvoiceGroup") or "Standard"

        print(f"[Fusion] LegalEntity={invoice_data.get('LegalEntity')} BusinessUnit={invoice_data.get('BusinessUnit')}")

        # ✅ invoiceLines validation and repair
        # Oracle requires at least 1 line — if Nova missed lines, create fallback from header
        lines = invoice_data.get("invoiceLines", [])
        if not isinstance(lines, list) or len(lines) == 0:
            print("[invoiceLines] WARNING: Nova returned no lines — creating fallback line from header amount")
            lines = [{
                "LineNumber":       1,
                "LineType":         "Item",
                "LineAmount":       invoice_data.get("InvoiceAmount", 0),
                "Description":      invoice_data.get("Description") or "Invoice line item",
                "AccountingDate":   invoice_data.get("InvoiceDate", ""),
                "TaxControlAmount": 0
            }]

        # Patch each line: fill missing AccountingDate and TaxControlAmount
        patched_lines = []
        for i, line in enumerate(lines):
            patched_line = {
                "LineNumber":       line.get("LineNumber") or (i + 1),
                "LineType":         line.get("LineType") or "Item",
                "LineAmount":       line.get("LineAmount") or 0,
                "Description":      line.get("Description") or invoice_data.get("Description") or "Invoice line item",
                "AccountingDate":   line.get("AccountingDate") or invoice_data.get("InvoiceDate", ""),
                "TaxControlAmount": line.get("TaxControlAmount") or 0,
            }
            patched_lines.append(patched_line)

        invoice_data["invoiceLines"] = patched_lines
        print(f"[invoiceLines] {len(patched_lines)} line(s) ready for Fusion")

        # Attachment payload for Oracle Fusion via Workato
        invoice_data["attachment"] = {
            "FileName":    file_name,
            "FileContents": base64_file,    # ✅ base64 is correct here for Workato/Fusion
            "Category":    "To Supplier",
            "ContentType": "application/pdf" if doc_format == "pdf" else f"image/{doc_format}",
            "Title":       f"Invoice {invoice_data.get('InvoiceNumber')}"
        }

        # -------------------------------------------------------
        # DynamoDB Write
        # -------------------------------------------------------
        sanitized = format_numbers(invoice_data)
        table.put_item(Item=sanitized)
        print(f"[DDB] Stored Invoice {inv_no} | Hash={document_hash}")

        # -------------------------------------------------------
        # Workato Trigger
        # -------------------------------------------------------
        headers = {"Content-Type": "application/json"}
        if WORKATO_API_TOKEN:
            headers["API-Token"] = WORKATO_API_TOKEN

        hook_resp = http.request(
            "POST",
            WORKATO_WEBHOOK_URL,
            body=json.dumps({"payload": invoice_data}),
            headers=headers
        )

        print(f"[Workato] Response Status: {hook_resp.status}")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message":        "Processed successfully",
                "invoice":        inv_no,
                "workato_status": hook_resp.status
            })
        }

    except Exception as e:
        print(f"Critical Error: {str(e)}")

        emit_audit_event_best_effort({
            "Decision":    "FAILED",
            "RejectLayer": "LAMBDA2_RUNTIME",
            "RejectCode":  "FAILED_EXCEPTION",
            "RejectReason": str(e)[:500],
            "DetectedAt":  now_iso(),
        })

        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }