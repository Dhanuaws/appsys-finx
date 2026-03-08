"""
Lambda 3: Invoice Audit Writer (CORRECTED)
------------------------------------------
Table  : InvoiceAuditLayer
Key    : AuditId (String) — Partition Key
Trigger: SQS (AUDIT_SQS_URL from Lambda 1)

Issues fixed vs old Lambda 3:
✅ AuditId was using event.get("eventId") which Lambda1 never sends → always fell back to uuid()
   but uuid() is generated AFTER the None check, meaning eventId=None was being stored as AuditId=""
   Fixed: always generate a fresh UUID as AuditId (guaranteed unique, never blank)
✅ Confidence stored as raw float → DynamoDB rejects floats, must be Decimal
   Fixed: convert_float_to_decimal() applied to full record, not just Confidence field
✅ Empty string stored for every optional field (SupplierSite, InvoiceAmount, etc.)
   DynamoDB rejects put_item with empty string values on non-key attributes
   Fixed: strip_empty_strings() removes any key whose value is "" before writing
✅ parse_sqs_body() bare except swallowed SNS unwrap errors silently
   Fixed: explicit except json.JSONDecodeError with logging
✅ No logging module — only print() used, CloudWatch logs have no severity levels
   Fixed: replaced all print() with proper logger calls (INFO / ERROR / WARNING)
✅ No dead-letter / partial batch failure handling — one bad record failed silently
   Fixed: raises exception on full batch failure so SQS can retry / DLQ
✅ Missing WrittenAt timestamp — no way to tell when Lambda3 wrote the record
   Fixed: WrittenAt field added to every record

Payload fields accepted from Lambda 1 emit_audit_best_effort():
  Decision, RejectLayer, RejectCode, RejectReason,
  DocumentHash, SourceFileName, MessageID, Sender,
  InvoiceNumber, Supplier / VendorName, SupplierSite,
  InvoiceAmount, InvoiceCurrency, BusinessKey,
  RawEmailS3Path, SilverS3Path, Subject, Confidence,
  DetectedAt (optional — auto-filled if missing)
"""

import json
import uuid
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import boto3


# ----------------------------
# CONFIG
# ----------------------------
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "InvoiceAuditLayer")

# ----------------------------
# AWS CLIENT
# ----------------------------
dynamodb = boto3.resource("dynamodb")
table    = dynamodb.Table(DYNAMODB_TABLE)

# ----------------------------
# LOGGING
# ----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit-writer")


# ----------------------------
# HELPERS
# ----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_str(value, max_len: int = 500) -> str:
    """Convert value to string and truncate. Returns None if empty so we can strip it."""
    if value is None:
        return None
    s = str(value).strip()
    return s[:max_len] if s else None


def convert_floats_to_decimal(obj):
    """
    Recursively convert all float values to Decimal.
    DynamoDB boto3 resource raises TypeError on plain floats.
    """
    if isinstance(obj, float):
        try:
            return Decimal(str(obj))
        except InvalidOperation:
            return Decimal("0")
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(i) for i in obj]
    return obj


def strip_empty_strings(record: dict) -> dict:
    """
    DynamoDB rejects put_item if any non-key attribute value is an empty string "".
    This removes all keys whose value is None or "".
    The only key guaranteed present is AuditId (partition key).
    """
    return {k: v for k, v in record.items() if v is not None and v != ""}


def parse_sqs_body(raw_body: str) -> dict:
    """
    Handles two formats:
    1. Direct JSON from Lambda 1 SQS send_message()
    2. SNS-wrapped JSON (if SQS is subscribed to an SNS topic)
    """
    try:
        data = json.loads(raw_body)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse SQS body as JSON: {e}")
        raise

    # SNS envelope unwrap
    if isinstance(data, dict) and "Message" in data and "Type" in data:
        try:
            inner = json.loads(data["Message"])
            logger.info("SNS envelope detected and unwrapped.")
            return inner
        except json.JSONDecodeError as e:
            logger.warning(f"SNS unwrap failed, using outer payload: {e}")
            return data

    return data


# ----------------------------
# BUILD AUDIT RECORD
# ----------------------------
def build_audit_record(event: dict) -> dict:
    """
    Maps Lambda 1 audit payload → InvoiceAuditLayer DynamoDB schema.

    AuditId is always a fresh UUID — guaranteed unique, never blank.
    Lambda 1 does not send an eventId field, so relying on it caused
    AuditId="" which DynamoDB rejects or silently overwrites prior records.
    """

    record = {
        # ── Primary Key ──────────────────────────────────────────────
        "AuditId": str(uuid.uuid4()),   # always fresh UUID

        # ── Timestamps ───────────────────────────────────────────────
        "DetectedAt": safe_str(
            event.get("DetectedAt") or event.get("emittedAt") or now_iso(), 60
        ),
        "WrittenAt": now_iso(),         # when Lambda3 actually wrote it

        # ── Decision ─────────────────────────────────────────────────
        "Decision":     safe_str(event.get("Decision"), 50),
        "RejectLayer":  safe_str(event.get("RejectLayer"), 100),
        "RejectCode":   safe_str(event.get("RejectCode"), 200),
        "RejectReason": safe_str(event.get("RejectReason"), 1000),

        # ── Invoice Fields ───────────────────────────────────────────
        "InvoiceNumber":   safe_str(event.get("InvoiceNumber"), 200),
        "Supplier":        safe_str(
                               event.get("Supplier") or event.get("VendorName"), 300
                           ),
        "SupplierSite":    safe_str(event.get("SupplierSite"), 200),
        "InvoiceAmount":   safe_str(event.get("InvoiceAmount"), 100),
        "InvoiceCurrency": safe_str(event.get("InvoiceCurrency"), 50),

        # ── Matching Identifiers ─────────────────────────────────────
        "DocumentHash": safe_str(event.get("DocumentHash"), 200),
        "BusinessKey":  safe_str(event.get("BusinessKey"), 300),

        # ── S3 Pointers ──────────────────────────────────────────────
        "RawEmailS3Path": safe_str(event.get("RawEmailS3Path"), 500),
        "SilverS3Path":   safe_str(event.get("SilverS3Path"), 500),
        "SourceFileName": safe_str(event.get("SourceFileName"), 300),

        # ── Email Metadata ───────────────────────────────────────────
        "MessageID": safe_str(event.get("MessageID"), 300),
        "Sender":    safe_str(event.get("Sender"), 300),
        "Subject":   safe_str(event.get("Subject"), 500),

        # ── AI Confidence ────────────────────────────────────────────
        # Stored as Decimal — floats are rejected by DynamoDB boto3 resource
        "Confidence": Decimal(str(event.get("Confidence", 0.0))),
    }

    # Remove None / "" values — DynamoDB rejects empty string attributes
    record = strip_empty_strings(record)

    # Convert any remaining floats (e.g. nested fields) to Decimal
    record = convert_floats_to_decimal(record)

    # AuditId must always be present (partition key)
    if "AuditId" not in record:
        record["AuditId"] = str(uuid.uuid4())

    return record


# ----------------------------
# WRITE TO DYNAMODB
# ----------------------------
def write_audit_record(record: dict):
    """
    Writes to InvoiceAuditLayer.
    Uses condition_expression to prevent accidental overwrite
    of an existing AuditId (shouldn't happen with UUID, but defensive).
    """
    table.put_item(
        Item=record,
        ConditionExpression="attribute_not_exists(AuditId)"
    )


# ----------------------------
# LAMBDA HANDLER
# ----------------------------
def lambda_handler(event, context):
    records = event.get("Records", [])
    logger.info(f"Lambda3 triggered — {len(records)} SQS record(s) received.")

    success       = 0
    failed        = 0
    failed_bodies = []

    for i, record in enumerate(records):
        try:
            raw_body   = record.get("body", "{}")
            payload    = parse_sqs_body(raw_body)
            audit_rec  = build_audit_record(payload)

            logger.info(
                f"[{i+1}/{len(records)}] Writing → "
                f"AuditId={audit_rec['AuditId']} "
                f"Layer={payload.get('RejectLayer')} "
                f"Code={payload.get('RejectCode')}"
            )

            write_audit_record(audit_rec)
            logger.info(f"✅ Written: AuditId={audit_rec['AuditId']}")
            success += 1

        except Exception as e:
            failed += 1
            logger.error(f"❌ Failed to write audit record [{i+1}]: {str(e)[:300]}")
            failed_bodies.append(record.get("body", "")[:200])

    logger.info(f"Done — SUCCESS: {success} | FAILED: {failed}")

    # If ALL records failed, raise so SQS retries the batch / routes to DLQ
    if failed > 0 and success == 0:
        raise RuntimeError(
            f"All {failed} audit record(s) failed to write. "
            f"SQS will retry. First failed body: {failed_bodies[0] if failed_bodies else 'N/A'}"
        )

    return {
        "statusCode": 200,
        "body": json.dumps({"success": success, "failed": failed})
    }