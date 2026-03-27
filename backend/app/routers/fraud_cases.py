"""
Fraud Cases Router — CRUD for FinXFraudCases.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.models import ActorContext
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


@router.get("")
def list_cases(
    status: Optional[str] = Query(default=None),
    actor: ActorContext = Depends(get_actor),
):
    """List fraud cases for the authenticated tenant."""
    cases = db_svc.list_fraud_cases(actor, status_filter=status)
    return {"items": cases, "count": len(cases)}


@router.patch("/{case_id}")
def update_case(
    case_id: str,
    body: UpdateCaseRequest,
    actor: ActorContext = Depends(get_actor),
):
    """Update status, severity, assignee, or resolution notes of a fraud case."""
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
    return updated


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
    return case
