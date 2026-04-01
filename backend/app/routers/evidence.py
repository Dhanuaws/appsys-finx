"""
Evidence Router — email evidence and signed attachment URLs.
All email/attachment access is gated by canViewEmails claim.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models import ActorContext
from app.services.rbac import get_actor, require_email_access
from app.config import get_settings
from app.services.s3 import get_email_evidence_for_invoice, generate_signed_url, generate_raw_signed_url, get_email_body_from_raw_path
from app.services.dynamodb import get_emails_by_invoice_number

log = logging.getLogger(__name__)
router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/email")
def get_email_by_invoice_number(
    invoice_number: str = Query(..., description="Invoice number to look up"),
    actor: ActorContext = Depends(get_actor),
):
    """
    Get email evidence from RawEmailMetaData by invoice number.
    Used when FinXEmailIndex is not populated.
    """
    emails = get_emails_by_invoice_number(actor, invoice_number)
    if not emails:
        raise HTTPException(
            status_code=404,
            detail=f"No email found for invoice number: {invoice_number}",
        )

    # Use first matching email
    meta = emails[0]
    s3_raw = meta.get("S3RawPath") or meta.get("s3RawPath", "")

    # Parse attachments JSON string
    attachments = []
    att_raw = meta.get("Attachments") or meta.get("attachments", "[]")
    try:
        att_list = json.loads(att_raw) if isinstance(att_raw, str) else att_raw
        for att in att_list:
            s3_key = att.get("s3") or att.get("s3Key", "")
            fname = att.get("file") or att.get("name", s3_key.split("/")[-1] if s3_key else "attachment")
            reject = att.get("rejectReason")
            signed = generate_raw_signed_url(actor, s3_key) if s3_key and not reject else None
            attachments.append({
                "name": fname,
                "s3Key": s3_key,
                "signedUrl": signed,
                "rejected": bool(reject),
                "rejectReason": reject,
            })
    except Exception as e:
        log.warning("Failed to parse Attachments for %s: %s", invoice_number, e)

    # Generate presigned URL for raw email .eml file
    raw_signed_url = generate_raw_signed_url(actor, s3_raw) if s3_raw else None

    # Fetch email body text from the raw .eml (RBAC-gated inside function)
    body = get_email_body_from_raw_path(actor, s3_raw) if s3_raw else None

    return {
        "messageId": meta.get("MessageID", ""),
        "subject": meta.get("Subject", ""),
        "sender": meta.get("Sender", ""),
        "receivedDate": meta.get("ReceivedDate", ""),
        "status": meta.get("Status", ""),
        "vendorName": meta.get("VendorName", ""),
        "invoiceNumber": meta.get("InvoiceNumber", invoice_number),
        "s3RawPath": s3_raw,
        "rawEmailUrl": raw_signed_url,
        "body": body,
        "attachments": attachments,
    }


@router.get("/{invoice_id}")
def get_email_evidence(
    invoice_id: str,
    actor: ActorContext = Depends(get_actor),
):
    """
    Get email evidence linked to an invoice.
    Body and signed attachment URLs only returned if canViewEmails=True.
    """
    evidence = get_email_evidence_for_invoice(actor, invoice_id)

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail=f"No linked email evidence found for invoice {invoice_id}.",
        )

    result = evidence.model_dump()

    # If no email access, scrub body
    if not actor.can_view_emails:
        result["body"] = None
        result["body_snippet"] = "Email body access is restricted for your account."
        for att in result.get("attachments", []):
            att["signed_url"] = None

    return result


@router.get("/attachment/signed-url")
def get_signed_url(
    s3_key: str = Query(..., description="S3 object key for the attachment"),
    actor: ActorContext = Depends(get_actor),
):
    """
    Generate a short-lived pre-signed URL for an email attachment.
    Requires canViewEmails claim.
    """
    # Hard RBAC check
    require_email_access(actor)

    # Use raw signed URL generator: handles s3:// prefixes and invoice keys
    # that pre-date per-tenant S3 prefixing (email-attachment/<hash>/... paths).
    url = generate_raw_signed_url(actor, s3_key)
    if not url:
        raise HTTPException(
            status_code=404,
            detail="Attachment not found or access denied.",
        )

    settings = get_settings()
    return {"signed_url": url, "ttl_seconds": settings.s3_signed_url_ttl, "s3_key": s3_key}
