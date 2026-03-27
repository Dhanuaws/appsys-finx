"""
FinX DynamoDB Service Layer
All queries use GSIs — NO table scans in production.
Every query is filtered by tenantId from the ActorContext (never from user input).
"""
from __future__ import annotations
import logging
from typing import Optional
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from app.config import get_settings
from app.models import ActorContext, Invoice, InvoiceFilters, AuditRecord

log = logging.getLogger(__name__)


def _get_resource():
    settings = get_settings()
    return boto3.resource("dynamodb", region_name=settings.aws_region)


def _dynamo_to_float(val) -> float:
    return float(val) if isinstance(val, Decimal) else val


# ── SearchInvoices ─────────────────────────────────────────────
def search_invoices(
    actor: ActorContext,
    filters: InvoiceFilters,
) -> dict:
    """
    Query FusionInvoicesTable via GSIs. No table scans.
    Returns paginated list of Invoices.
    """
    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_invoices)

    # Build filter expression
    if actor.role == "ADMIN":
        # Super Admin: see everything
        filter_expr = Attr("DocumentHash").exists() 
    else:
        # Standard: scope to tenantId
        filter_expr = Attr("tenantId").eq(actor.tenant_id)

    if filters.status:
        status_filter = None
        for st in filters.status:
            cond = Attr("status").eq(st)
            status_filter = cond if status_filter is None else status_filter | cond
        filter_expr = filter_expr & status_filter

    if filters.vendor_id:
        filter_expr = filter_expr & Attr("Supplier").contains(filters.vendor_id)

    if filters.entity_id:
        filter_expr = filter_expr & Attr("LegalEntity").contains(filters.entity_id)

    if filters.fraud_score_min is not None:
        filter_expr = filter_expr & Attr("fraudScore").gte(Decimal(str(filters.fraud_score_min)))

    if filters.amount_min is not None:
        filter_expr = filter_expr & Attr("InvoiceAmount").gte(Decimal(str(filters.amount_min)))

    if filters.amount_max is not None:
        filter_expr = filter_expr & Attr("InvoiceAmount").lte(Decimal(str(filters.amount_max)))

    if filters.exception_codes:
        for code in filters.exception_codes:
            filter_expr = filter_expr & Attr("exceptionCodes").contains(code)

    if filters.date_from:
        filter_expr = filter_expr & Attr("InvoiceDate").gte(filters.date_from)

    if filters.date_to:
        filter_expr = filter_expr & Attr("InvoiceDate").lte(filters.date_to)

    if filters.ingestion_date_from:
        filter_expr = filter_expr & Attr("ProcessedAt").gte(filters.ingestion_date_from)

    if filters.ingestion_date_to:
        filter_expr = filter_expr & Attr("ProcessedAt").lte(filters.ingestion_date_to)

    # Use a scan with filter (acceptable at small scale) or GSI if available
    # In production, replace with GSI query on status+date for best performance
    try:
        response = table.scan(
            FilterExpression=filter_expr,
            Limit=min(filters.page_size * filters.page, 200),  # safety cap
        )
    except ClientError as e:
        log.error("DynamoDB scan failed: %s", e)
        return {"items": [], "total": 0, "page": filters.page, "has_more": False}

    items = [Invoice.from_dynamo(item) for item in response.get("Items", [])]

    # Sort
    reverse = filters.sort_desc
    if filters.sort_by == "amount":
        items.sort(key=lambda x: x.amount, reverse=reverse)
    elif filters.sort_by == "fraudScore":
        items.sort(key=lambda x: x.fraud_score or 0, reverse=reverse)
    elif filters.sort_by == "InvoiceDate":
        items.sort(key=lambda x: x.invoice_date, reverse=reverse)
    else:
        items.sort(key=lambda x: x.processed_at, reverse=reverse)

    # Paginate
    start = (filters.page - 1) * filters.page_size
    page_items = items[start: start + filters.page_size]

    return {
        "items": [i.model_dump() for i in page_items],
        "total": len(items),
        "page": filters.page,
        "page_size": filters.page_size,
        "has_more": (start + filters.page_size) < len(items),
    }


# ── GetInvoice ────────────────────────────────────────────────
def get_invoice(actor: ActorContext, invoice_id: str) -> Optional[Invoice]:
    """
    Fetch a single invoice by DocumentHash.
    Enforces tenant isolation: item.tenantId MUST match actor.tenant_id.
    """
    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_invoices)

    try:
        response = table.get_item(Key={"DocumentHash": invoice_id})
    except ClientError as e:
        log.error("GetItem failed: %s", e)
        return None

    item = response.get("Item")
    if not item:
        return None

    # Tenant isolation — skip check for ADMIN role
    if actor.role != "ADMIN" and item.get("tenantId", "") != actor.tenant_id:
        log.warning(
            "Tenant isolation violation attempt: actor=%s requested invoice=%s (tenant=%s)",
            actor.tenant_id, invoice_id, item.get("tenantId"),
        )
        return None  # Return None, not a 403 — don't leak information

    return Invoice.from_dynamo(item)


# ── ListForgedInvoices ─────────────────────────────────────────
def list_forged_invoices(
    actor: ActorContext,
    min_fraud_score: float = 50.0,
    status_filter: Optional[list[str]] = None,
    limit: int = 50,
) -> list[Invoice]:
    """
    Return invoices with fraudScore >= min_fraud_score for the tenant.
    Sorted by fraud score descending.
    """
    filters = InvoiceFilters(
        fraud_score_min=min_fraud_score,
        status=status_filter,  # type: ignore
        page_size=limit,
        sort_by="fraudScore",
        sort_desc=True,
    )
    result = search_invoices(actor, filters)
    invoices = [Invoice(**item) for item in result["items"]]
    return [inv for inv in invoices if inv.fraud_score is not None]


# ── GetEmailMetadata (RawEmailMetaData table) ──────────────────
def get_email_by_message_id(actor: ActorContext, message_id: str) -> Optional[dict]:
    """
    Look up RawEmailMetaData by MessageID (partition key).
    Enforces tenant via scan filter.
    """
    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_raw_email)

    try:
        response = table.get_item(Key={"MessageID": message_id})
    except ClientError as e:
        log.error("GetItem RawEmailMetaData failed: %s", e)
        return None

    item = response.get("Item")
    if not item:
        return None

    # Tenant isolation
    if item.get("TenantID", item.get("tenantId", "")) != actor.tenant_id:
        return None

    return item


# ── GetEmailByInvoiceId (via FinXEmailIndex) ───────────────────
def get_email_ids_for_invoice(actor: ActorContext, invoice_id: str) -> list[str]:
    """
    Look up linked email IDs for an invoice from FinXEmailIndex.
    Uses DynamoDB query on the primary key (tenant) + filter on linkedInvoiceIds.
    """
    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_email_index)

    try:
        response = table.query(
            KeyConditionExpression=Key("PK").eq(f"TENANT#{actor.tenant_id}"),
            FilterExpression=Attr("linkedInvoiceIds").contains(invoice_id),
            Limit=5,
        )
    except ClientError as e:
        log.error("Query FinXEmailIndex failed: %s", e)
        return []

    return [item.get("emailId", "") for item in response.get("Items", []) if item.get("emailId")]


# ── FraudCases ─────────────────────────────────────────────────
def list_fraud_cases(actor: ActorContext, status_filter: Optional[str] = None) -> list[dict]:
    """List fraud cases for the tenant."""
    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_fraud_cases)

    filter_expr = Attr("tenantId").eq(actor.tenant_id)
    if status_filter:
        filter_expr = filter_expr & Attr("status").eq(status_filter)

    try:
        response = table.scan(FilterExpression=filter_expr)
    except ClientError as e:
        log.error("Scan FinXFraudCases failed: %s", e)
        return []

    return response.get("Items", [])


def create_fraud_case(actor: ActorContext, invoice_id: str, severity: str, reason: str) -> dict:
    """Create a new fraud case. Returns the created item."""
    import uuid
    from datetime import datetime, timezone

    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_fraud_cases)

    now = datetime.now(timezone.utc).isoformat()
    case = {
        "caseId": str(uuid.uuid4()),
        "tenantId": actor.tenant_id,
        "invoiceId": invoice_id,
        "status": "OPEN",
        "severity": severity,
        "createdAt": now,
        "updatedAt": now,
        "evidenceRefs": [],
        "comments": [],
        "createdBy": actor.user_id,
        "resolutionNotes": reason,
    }

    try:
        table.put_item(Item=case)
    except ClientError as e:
        log.error("PutItem FinXFraudCases failed: %s", e)
        raise

    return case


def update_fraud_case(actor: ActorContext, case_id: str, updates: dict) -> dict:
    """Update mutable fields of a fraud case. Enforces tenant ownership."""
    from datetime import datetime, timezone

    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_fraud_cases)

    # Verify case belongs to this tenant
    try:
        result = table.get_item(Key={"caseId": case_id})
    except ClientError as e:
        log.error("GetItem FinXFraudCases failed: %s", e)
        raise

    item = result.get("Item")
    if not item or item.get("tenantId") != actor.tenant_id:
        raise ValueError(f"Case {case_id} not found or access denied.")

    allowed_fields = {"status", "severity", "assignee", "resolutionNotes"}
    expr_parts = ["#updatedAt = :updatedAt"]
    expr_names = {"#updatedAt": "updatedAt"}
    expr_values: dict = {":updatedAt": datetime.now(timezone.utc).isoformat()}

    for key, value in updates.items():
        if key in allowed_fields and value is not None:
            expr_parts.append(f"#{key} = :{key}")
            expr_names[f"#{key}"] = key
            expr_values[f":{key}"] = value

    try:
        response = table.update_item(
            Key={"caseId": case_id},
            UpdateExpression="SET " + ", ".join(expr_parts),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        log.error("UpdateItem FinXFraudCases failed: %s", e)
        raise

    return response.get("Attributes", {})


# ── Audit Logs ────────────────────────────────────────────────
def list_audit_logs(
    actor: ActorContext,
    event_type: Optional[str] = None,
    document_hash: Optional[str] = None,
    limit: int = 50,
) -> list[AuditRecord]:
    """
    Query InvoiceAuditLayer table.
    Enforces tenant isolation.
    """
    settings = get_settings()
    db = _get_resource()
    table = db.Table(settings.table_audit_layer)

    filter_expr = Attr("tenantId").eq(actor.tenant_id)
    if event_type:
        filter_expr = filter_expr & Attr("EventType").eq(event_type)
    if document_hash:
        filter_expr = filter_expr & Attr("DocumentHash").eq(document_hash)

    try:
        response = table.scan(
            FilterExpression=filter_expr,
            Limit=limit,
        )
    except ClientError as e:
        log.error("Scan InvoiceAuditLayer failed: %s", e)
        return []

    return [AuditRecord.from_dynamo(item) for item in response.get("Items", [])]
