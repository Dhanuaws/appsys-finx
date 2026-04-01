"""
Fraud Cases Router — CRUD for FinXFraudCases.
"""
import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.models import ActorContext, Invoice, InvoiceFilters
from app.services.rbac import get_actor
from app.services import dynamodb as db_svc

log = logging.getLogger(__name__)
router = APIRouter(prefix="/fraud-cases", tags=["fraud-cases"])


class CreateCaseRequest(BaseModel):
    invoice_id: str
    severity: str = "MEDIUM"
    reason: str = ""


class UpdateCaseRequest(BaseModel):
    status: Optional[str] = None       # OPEN | IN_REVIEW | RESOLVED
    severity: Optional[str] = None     # LOW | MEDIUM | HIGH | CRITICAL
    assignee: Optional[str] = None
    resolution_notes: Optional[str] = None


def _invoice_to_camel(inv: Invoice) -> dict:
    """Convert Invoice model to camelCase dict for the frontend."""
    d = inv.model_dump()
    return {
        "invoiceId": d.get("invoice_id", ""),
        "tenantId": d.get("tenant_id", ""),
        "invoiceNumber": d.get("invoice_number", ""),
        "vendorId": d.get("vendor_id", ""),
        "vendorName": d.get("vendor_name", "") or d.get("vendor_id", ""),
        "entityId": d.get("entity_id", ""),
        "invoiceDate": d.get("invoice_date", ""),
        "amount": d.get("amount", 0.0),
        "currency": d.get("currency", "USD"),
        "status": d.get("status", "RAW"),
        "exceptionCodes": d.get("exception_codes", []),
        "duplicateOfInvoiceId": d.get("duplicate_of_invoice_id"),
        "fraudScore": d.get("fraud_score"),
        "fraudReasons": d.get("fraud_reasons", []),
        "documentRef": d.get("document_ref"),
        "linkedEmailIds": d.get("linked_email_ids", []),
        "processedAt": d.get("processed_at", ""),
        "s3Location": d.get("s3_location"),
    }


def _sanitize_dynamo(val):
    """Recursively convert Decimal → float/int for JSON serialisation."""
    if isinstance(val, Decimal):
        return int(val) if val == int(val) else float(val)
    if isinstance(val, dict):
        return {k: _sanitize_dynamo(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_sanitize_dynamo(v) for v in val]
    return val


def _enrich_case(raw: dict, actor: ActorContext) -> dict:
    """Add embedded invoice data and sanitize DynamoDB types."""
    raw = _sanitize_dynamo(raw)
    invoice_id = raw.get("invoiceId") or raw.get("invoice_id", "")
    invoice_data = None
    if invoice_id:
        # Primary lookup: by DocumentHash (full SHA-256)
        inv = db_svc.get_invoice(actor, invoice_id)
        if not inv:
            # Fallback: invoice_id may be an invoice NUMBER — search for it
            result = db_svc.search_invoices(actor, InvoiceFilters(invoice_number=invoice_id, page_size=1))
            items = result.get("items", [])
            if items:
                inv = Invoice(**items[0])
        if inv:
            invoice_data = _invoice_to_camel(inv)
    return {
        **raw,
        "invoice": invoice_data,
        "comments": raw.get("comments", []),
        "evidenceRefs": raw.get("evidenceRefs", []),
    }


@router.get("")
def list_cases(
    status: Optional[str] = Query(default=None),
    actor: ActorContext = Depends(get_actor),
):
    """
    List fraud cases for the authenticated tenant.
    Includes manually created cases + auto-detected FORGED/DUPLICATE invoices.
    """
    from datetime import datetime, timezone

    # ── 1. Existing manual fraud cases ────────────────────────────
    raw_cases = db_svc.list_fraud_cases(actor, status_filter=status)
    enriched_cases = [_enrich_case(c, actor) for c in raw_cases]
    existing_invoice_ids = {c.get("invoiceId", "") for c in enriched_cases}

    # ── 2. Auto-detect: FORGED invoices not yet in a case ─────────
    # Only include auto-detected when not filtering by a specific status
    if not status or status == "OPEN":
        try:
            forged_result = db_svc.search_invoices(
                actor,
                InvoiceFilters(status=["FORGED", "DUPLICATE"], page_size=50, sort_by="fraudScore", sort_desc=True),
            )
            now = datetime.now(timezone.utc).isoformat()
            for item in forged_result.get("items", []):
                inv_id = item.get("invoice_id", "")
                if not inv_id or inv_id in existing_invoice_ids:
                    continue
                inv = Invoice(**item)
                fraud_score = inv.fraud_score or 0
                severity = "CRITICAL" if fraud_score >= 85 else "HIGH" if fraud_score >= 60 else "MEDIUM"
                enriched_cases.append({
                    "caseId": f"auto-{inv_id[:12]}",
                    "tenantId": actor.tenant_id,
                    "invoiceId": inv_id,
                    "status": "OPEN",
                    "severity": severity,
                    "createdAt": inv.processed_at or now,
                    "updatedAt": inv.processed_at or now,
                    "comments": [],
                    "evidenceRefs": [],
                    "assignee": None,
                    "slaDeadline": None,
                    "resolution": None,
                    "invoice": _invoice_to_camel(inv),
                })
                existing_invoice_ids.add(inv_id)
        except Exception as e:
            log.warning("Could not fetch auto-detected FORGED invoices: %s", e)

    # Sort: OPEN first, then by createdAt descending within each group
    enriched_cases.sort(
        key=lambda c: (0 if c.get("status") == "OPEN" else 1, c.get("createdAt", "")),
        reverse=False,
    )

    return {"items": enriched_cases, "count": len(enriched_cases)}


@router.patch("/{case_id}")
def update_case(
    case_id: str,
    body: UpdateCaseRequest,
    actor: ActorContext = Depends(get_actor),
):
    """Update status, severity, assignee, or resolution notes of a fraud case."""
    # Auto-generated case IDs start with "auto-" — can't update those in DynamoDB
    if case_id.startswith("auto-"):
        raise HTTPException(status_code=400, detail="Auto-detected cases cannot be updated. Create a manual case first.")
    updates = {
        "status": body.status,
        "severity": body.severity,
        "assignee": body.assignee,
        "resolutionNotes": body.resolution_notes,
    }
    try:
        updated = db_svc.update_fraud_case(actor, case_id, updates)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _sanitize_dynamo(updated)


@router.post("")
def create_case(
    body: CreateCaseRequest,
    actor: ActorContext = Depends(get_actor),
):
    """Open a new fraud case. Requires APPROVER, CONTROLLER, or ADMIN role."""
    if actor.role not in ("APPROVER", "CONTROLLER", "ADMIN"):
        raise HTTPException(
            status_code=403,
            detail=f"Role '{actor.role}' cannot create fraud cases.",
        )
    case = db_svc.create_fraud_case(
        actor,
        invoice_id=body.invoice_id,
        severity=body.severity,
        reason=body.reason,
    )
    # Enrich the newly created case with invoice data
    return _enrich_case(case, actor)
