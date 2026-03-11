"""
FinX S3 Evidence Service
Parses raw email data from S3 and generates RBAC-gated signed URLs.
Supports SES-stored email format (email body as JSON metadata + attachments).
"""
from __future__ import annotations
import json
import logging
import email as email_lib
from typing import Optional
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings
from app.models import ActorContext, EmailEvidence, EmailAttachment
from app.services.rbac import require_email_access
from app.services.dynamodb import get_email_ids_for_invoice, get_email_by_message_id

log = logging.getLogger(__name__)


def _get_s3():
    settings = get_settings()
    return boto3.client("s3", region_name=settings.aws_region)


# ── Signed URL Generator ──────────────────────────────────────
def generate_signed_url(actor: ActorContext, s3_key: str) -> Optional[str]:
    """
    Generate a pre-signed S3 GET URL.
    RBAC guard: requires canViewEmails.
    Returns None if access denied (never raises — let caller decide 403 vs silently omit).
    """
    if not actor.can_view_emails:
        return None

    # Scope check: key must start with tenantId prefix
    settings = get_settings()
    if not s3_key.startswith(actor.tenant_id + "/"):
        log.warning(
            "Signed URL cross-tenant attempt: actor=%s key=%s", actor.tenant_id, s3_key
        )
        return None  # silent deny — don't reveal the key exists

    s3 = _get_s3()
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": s3_key},
            ExpiresIn=settings.s3_signed_url_ttl,
        )
        return url
    except ClientError as e:
        log.error("Failed to generate signed URL for %s: %s", s3_key, e)
        return None
        return None


# ── Zip Stream Generator ──────────────────────────────────────
def generate_zip_stream(actor: ActorContext, s3_keys: list[str]) -> Optional[bytes]:
    """
    Download multiple S3 objects and compress them into an in-memory ZIP file.
    Enforces tenant isolation on all keys.
    """
    import io
    import zipfile

    if not s3_keys:
        return None

    settings = get_settings()
    s3 = _get_s3()
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for key in s3_keys:
            # Scope check: key must start with tenantId prefix
            if not key.startswith(actor.tenant_id + "/"):
                log.warning("Zip cross-tenant attempt: actor=%s key=%s", actor.tenant_id, key)
                continue # Skip invalid keys rather than failing entirely

            try:
                # Get object from S3
                response = s3.get_object(Bucket=settings.s3_bucket, Key=key)
                file_bytes = response["Body"].read()
                
                # Extract filename from key for the zip archive
                filename = key.split("/")[-1]
                
                # Add to zip
                zf.writestr(filename, file_bytes)
            except ClientError as e:
                log.error("Failed to fetch %s for zip: %s", key, e)
                # Continue zipping the rest
    
    # Return the bytes of the zip file
    zip_buffer.seek(0)
    zip_bytes = zip_buffer.read()
    
    # If the zip is essentially empty (no files succeeded), return None
    if len(zip_bytes) < 100 and b"PK" not in zip_bytes[:2]:
         return None
         
    return zip_bytes

# ── Email Evidence Retrieval ──────────────────────────────────
def get_email_evidence_for_invoice(
    actor: ActorContext,
    invoice_id: str,
) -> Optional[EmailEvidence]:
    """
    Main entrypoint: given an invoice_id, returns email evidence
    including RBAC-gated body and attachment signed URLs.
    """
    # Step 1: Find linked email IDs via FinXEmailIndex
    email_ids = get_email_ids_for_invoice(actor, invoice_id)

    if not email_ids:
        # Fallback: try looking up by the invoice_id as a message_id
        raw = get_email_by_message_id(actor, invoice_id)
        if raw:
            return _build_evidence_from_raw_email_meta(actor, raw)
        return None

    # Use the first linked email
    email_meta = get_email_by_message_id(actor, email_ids[0])
    if not email_meta:
        return None

    return _build_evidence_from_raw_email_meta(actor, email_meta)


def _build_evidence_from_raw_email_meta(
    actor: ActorContext,
    meta: dict,
) -> EmailEvidence:
    """
    Build EmailEvidence from a RawEmailMetaData DynamoDB item.
    Body and full attachments are gated by canViewEmails.
    """
    settings = get_settings()
    email_id = meta.get("MessageID", "")

    # Try to fetch the full email from S3 if we have an S3 key
    s3_key = meta.get("S3Key", meta.get("s3Key", ""))
    body_text = None
    attachments: list[EmailAttachment] = []

    if s3_key and actor.can_view_emails:
        body_text, attachments = _parse_email_from_s3(actor, s3_key, email_id)
    elif s3_key:
        # Build attachment stubs without signed URLs (RBAC denied)
        attachments = _attachment_stubs_from_meta(meta, actor)

    body_snippet = (body_text[:300] + "…") if body_text and len(body_text) > 300 else (body_text or "")

    return EmailEvidence(
        email_id=email_id,
        tenant_id=actor.tenant_id,
        sender=meta.get("Sender", meta.get("sender", "Unknown")),
        date=meta.get("ReceivedDate", meta.get("receivedDate", "")),
        subject=meta.get("Subject", meta.get("subject", "(No Subject)")),
        body_snippet=body_snippet,
        body=body_text if actor.can_view_emails else None,
        attachments=attachments,
        linked_invoice_ids=meta.get("linkedInvoiceIds", []),
        s3_key=s3_key,
    )


def _parse_email_from_s3(
    actor: ActorContext,
    s3_key: str,
    email_id: str,
) -> tuple[Optional[str], list[EmailAttachment]]:
    """
    Download raw email from S3 and parse body + attachments.
    Supports:
    - .eml (raw MIME format — SES default)
    - JSON metadata file with bodyKey + attachmentKeys
    """
    settings = get_settings()
    s3 = _get_s3()

    try:
        obj = s3.get_object(Bucket=settings.s3_bucket, Key=s3_key)
        raw = obj["Body"].read()
    except ClientError as e:
        log.warning("Could not fetch email from S3: %s", e)
        return None, []

    # Detect format
    if s3_key.endswith(".json"):
        return _parse_json_email(actor, raw, email_id)
    else:
        # Assume raw MIME / .eml
        return _parse_mime_email(actor, raw, s3_key, email_id)


def _parse_mime_email(
    actor: ActorContext,
    raw: bytes,
    s3_key: str,
    email_id: str,
) -> tuple[Optional[str], list[EmailAttachment]]:
    """Parse a raw MIME email (.eml format from SES)."""
    msg = email_lib.message_from_bytes(raw)

    body_text = None
    attachments: list[EmailAttachment] = []

    # Base S3 prefix for attachments: same folder as the email
    base_prefix = "/".join(s3_key.split("/")[:-1])

    for i, part in enumerate(msg.walk()):
        content_type = part.get_content_type()
        disposition = str(part.get("Content-Disposition", ""))

        if content_type == "text/plain" and "attachment" not in disposition:
            # Email body
            payload = part.get_payload(decode=True)
            if payload:
                body_text = payload.decode("utf-8", errors="replace")

        elif "attachment" in disposition or content_type.startswith("application/") or content_type.startswith("image/"):
            filename = part.get_filename() or f"attachment_{i}"
            # Build the expected S3 key for the attachment
            att_key = f"{base_prefix}/attachments/{email_id}_{filename}"
            att_id = f"{email_id}_att_{i}"

            signed_url = generate_signed_url(actor, att_key)

            attachments.append(EmailAttachment(
                attachment_id=att_id,
                name=filename,
                mime_type=content_type,
                s3_key=att_key,
                size_bytes=len(part.get_payload(decode=True) or b""),
                signed_url=signed_url,
            ))

    return body_text, attachments


def _parse_json_email(
    actor: ActorContext,
    raw: bytes,
    email_id: str,
) -> tuple[Optional[str], list[EmailAttachment]]:
    """Parse a JSON metadata email (custom format)."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None, []

    body_text = data.get("body") or data.get("bodyText")
    raw_atts = data.get("attachments", [])

    attachments = []
    for att in raw_atts:
        att_key = att.get("s3Key", "")
        signed_url = generate_signed_url(actor, att_key)
        attachments.append(EmailAttachment(
            attachment_id=att.get("attachmentId", att_key),
            name=att.get("name", "attachment"),
            mime_type=att.get("mimeType", "application/octet-stream"),
            s3_key=att_key,
            size_bytes=att.get("sizeBytes", 0),
            signed_url=signed_url,
        ))

    return body_text, attachments


def _attachment_stubs_from_meta(meta: dict, actor: ActorContext) -> list[EmailAttachment]:
    """
    Return attachment stubs from DynamoDB metadata (no S3 fetch).
    signedUrl is always None — canViewEmails check blocked access.
    """
    return [
        EmailAttachment(
            attachment_id=key,
            name=key.split("/")[-1],
            mime_type="application/octet-stream",
            s3_key=key,
            size_bytes=0,
            signed_url=None,  # RBAC blocked
        )
        for key in meta.get("attachmentKeys", [])
    ]
