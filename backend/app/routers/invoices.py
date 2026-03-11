"""
Invoices Router — invoice search, retrieval, and forged listing.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.models import ActorContext, InvoiceFilters
from app.services.rbac import get_actor
from app.services import dynamodb as db_svc
from app.services.s3 import generate_zip_stream

log = logging.getLogger(__name__)
router = APIRouter(prefix="/invoices", tags=["invoices"])

class ZipDownloadRequest(BaseModel):
    s3_keys: list[str]


@router.get("")
def search_invoices(
    # Filters as query params
    status: Optional[list[str]] = Query(default=None),
    vendor: Optional[str] = Query(default=None),
    entity: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    fraud_score_min: Optional[float] = Query(default=None, ge=0, le=100),
    amount_min: Optional[float] = Query(default=None, ge=0),
    amount_max: Optional[float] = Query(default=None, ge=0),
    exception_codes: Optional[list[str]] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="processedAt"),
    sort_desc: bool = Query(default=True),
    actor: ActorContext = Depends(get_actor),
):
    """Search invoices with server-side filters. tenantId always from auth token."""
    filters = InvoiceFilters(
        status=status,  # type: ignore
        vendor_id=vendor,
        entity_id=entity,
        date_from=date_from,
        date_to=date_to,
        fraud_score_min=fraud_score_min,
        amount_min=amount_min,
        amount_max=amount_max,
        exception_codes=exception_codes,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )
    return db_svc.search_invoices(actor, filters)


@router.get("/forged")
def list_forged_invoices(
    min_fraud_score: float = Query(default=50.0, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
    actor: ActorContext = Depends(get_actor),
):
    """List invoices with high fraud scores. Sorted by fraud score descending."""
    invoices = db_svc.list_forged_invoices(actor, min_fraud_score=min_fraud_score, limit=limit)
    return {
        "items": [i.model_dump() for i in invoices],
        "count": len(invoices),
        "min_fraud_score": min_fraud_score,
    }


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: str,
    actor: ActorContext = Depends(get_actor),
):
    """Get full invoice details. Returns 404 if not found or not in actor's tenant."""
    invoice = db_svc.get_invoice(actor, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found.")
    return invoice.model_dump()


@router.post("/download-zip")
def download_invoices_zip(
    request: ZipDownloadRequest,
    actor: ActorContext = Depends(get_actor)
):
    """
    Download multiple invoices or attachments as a single Zip file.
    Accepts a list of full S3 keys. Validates tenant access for all keys.
    """
    if not request.s3_keys:
        raise HTTPException(status_code=400, detail="No S3 keys provided.")
        
    # Cap bulk download to prevent memory/timeout issues
    if len(request.s3_keys) > 20: 
        raise HTTPException(status_code=400, detail="Cannot bulk download more than 20 files at once.")

    zip_bytes = generate_zip_stream(actor, request.s3_keys)
    
    if not zip_bytes:
        raise HTTPException(status_code=404, detail="No files could be downloaded or access was denied.")
        
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=finx_invoices.zip"
        }
    )
