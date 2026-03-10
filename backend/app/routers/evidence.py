"""
Evidence Router — email evidence and signed attachment URLs.
All email/attachment access is gated by canViewEmails claim.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models import ActorContext
from app.services.rbac import get_actor, require_email_access
from app.services.s3 import get_email_evidence_for_invoice, generate_signed_url

log = logging.getLogger(__name__)
router = APIRouter(prefix="/evidence", tags=["evidence"])


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

    url = generate_signed_url(actor, s3_key)
    if not url:
        raise HTTPException(
            status_code=404,
            detail="Attachment not found or access denied.",
        )

    settings_ttl = 900  # 15 min
    return {"signed_url": url, "ttl_seconds": settings_ttl, "s3_key": s3_key}
