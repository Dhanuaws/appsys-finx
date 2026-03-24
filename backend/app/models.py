"""
FinX Backend — Pydantic Models
All request/response schemas used across the API.
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ── RBAC / Session ────────────────────────────────────────────
class ActorContext(BaseModel):
    """Derived from the validated Cognito JWT. Never from user input."""
    user_id: str
    tenant_id: str
    email: str
    name: str
    role: Literal["AP_CLERK", "APPROVER", "CONTROLLER", "AUDITOR", "ADMIN"]
    can_view_emails: bool = False
    pii_access: bool = False
    can_approve_payments: bool = False
    max_approval_limit: float = 0.0
    entity_ids: list[str] = []
    cost_centers: list[str] = []
    vendor_ids: list[str] = []


# ── Audit Layer ────────────────────────────────────────────────
class AuditRecord(BaseModel):
    audit_id: str = Field(alias="AuditId")
    event_type: str = Field(alias="EventType")
    document_hash: Optional[str] = Field(alias="DocumentHash", default=None)
    tenant_id: str = Field(alias="tenantId", default="")
    status: str = Field(default="LOGGED")
    reason: Optional[str] = None
    message: str = ""
    processed_at: str = Field(alias="ProcessedAt", default="")
    metadata: dict = {}

    model_config = {"populate_by_name": True}

    @classmethod
    def from_dynamo(cls, item: dict) -> "AuditRecord":
        return cls(
            AuditId=item.get("AuditId", ""),
            EventType=item.get("EventType", ""),
            DocumentHash=item.get("DocumentHash"),
            tenantId=item.get("tenantId", ""),
            status=item.get("status", "LOGGED"),
            reason=item.get("reason"),
            message=item.get("message", ""),
            ProcessedAt=item.get("ProcessedAt", ""),
            metadata=item.get("metadata", {})
        )


# ── Invoice ────────────────────────────────────────────────────
class InvoiceLine(BaseModel):
    line_number: int
    line_type: str = "Item"
    line_amount: float
    description: str = ""
    accounting_date: str = ""
    tax_control_amount: float = 0.0


class Invoice(BaseModel):
    invoice_id: str = Field(alias="DocumentHash")
    tenant_id: str = Field(default="")
    invoice_number: str = Field(alias="InvoiceNumber", default="")
    vendor_id: str = Field(alias="Supplier", default="")
    vendor_name: str = Field(alias="Supplier", default="")
    entity_id: str = Field(alias="LegalEntity", default="")
    invoice_date: str = Field(alias="InvoiceDate", default="")
    amount: float = Field(alias="InvoiceAmount", default=0.0)
    currency: str = Field(alias="Currency", default="USD")
    status: Literal["RAW", "DUPLICATE", "SUCCESS", "FORGED"] = "RAW"
    exception_codes: list[str] = []
    duplicate_of_invoice_id: Optional[str] = None
    fraud_score: Optional[float] = None
    fraud_reasons: list[str] = []
    document_ref: Optional[str] = None
    linked_email_ids: list[str] = []
    processed_at: str = ""
    invoice_lines: list[InvoiceLine] = []
    s3_location: Optional[str] = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_dynamo(cls, item: dict) -> "Invoice":
        """Build from raw DynamoDB item."""
        return cls(
            DocumentHash=item.get("DocumentHash", ""),
            InvoiceNumber=item.get("InvoiceNumber", ""),
            Supplier=item.get("Supplier", ""),
            LegalEntity=item.get("LegalEntity", ""),
            InvoiceDate=item.get("InvoiceDate", ""),
            InvoiceAmount=float(item.get("InvoiceAmount", 0)),
            Currency=item.get("Currency", "USD"),
            status=item.get("status", "RAW"),
            exception_codes=item.get("exceptionCodes", []),
            duplicate_of_invoice_id=item.get("duplicateOfInvoiceId"),
            fraud_score=float(item["fraudScore"]) if item.get("fraudScore") else None,
            fraud_reasons=item.get("fraudReasons", []),
            document_ref=item.get("documentRef"),
            linked_email_ids=item.get("linkedEmailIds", []),
            processed_at=item.get("ProcessedAt", item.get("processedAt", "")),
            s3_location=item.get("S3_Location", item.get("s3Location")),
            tenant_id=item.get("tenantId", ""),
        )


# ── Email Evidence ─────────────────────────────────────────────
class EmailAttachment(BaseModel):
    attachment_id: str
    name: str
    mime_type: str = "application/octet-stream"
    s3_key: str
    size_bytes: int = 0
    signed_url: Optional[str] = None  # None if canViewEmails=False


class EmailEvidence(BaseModel):
    email_id: str
    tenant_id: str
    sender: str
    date: str
    subject: str
    body_snippet: str = ""
    body: Optional[str] = None       # Only if canViewEmails=True
    attachments: list[EmailAttachment] = []
    linked_invoice_ids: list[str] = []
    s3_key: str = ""


# ── Fraud Case ─────────────────────────────────────────────────
class CaseComment(BaseModel):
    comment_id: str
    author: str
    text: str
    created_at: str
    mentions: list[str] = []


class FraudCase(BaseModel):
    case_id: str
    tenant_id: str
    invoice_id: str
    invoice: Optional[Invoice] = None
    status: Literal["OPEN", "IN_REVIEW", "RESOLVED"] = "OPEN"
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    assignee: Optional[str] = None
    comments: list[CaseComment] = []
    created_at: str
    updated_at: str
    sla_deadline: Optional[str] = None
    evidence_refs: list[str] = []
    resolution: Optional[str] = None


# ── Chat ──────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    audit_mode: bool = False
    conversation_history: list[dict] = []


class Citation(BaseModel):
    type: Literal["invoice", "email", "attachment", "case"]
    id: str
    label: str
    s3_key: Optional[str] = None


# ── Invoice Filters (validated server-side) ────────────────────
class InvoiceFilters(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    ingestion_date_from: Optional[str] = None
    ingestion_date_to: Optional[str] = None
    status: Optional[list[Literal["RAW", "DUPLICATE", "SUCCESS", "FORGED"]]] = None
    vendor_id: Optional[str] = None
    entity_id: Optional[str] = None
    fraud_score_min: Optional[float] = Field(default=None, ge=0, le=100)
    amount_min: Optional[float] = Field(default=None, ge=0)
    amount_max: Optional[float] = Field(default=None, ge=0)
    exception_codes: Optional[list[str]] = None
    search: Optional[str] = Field(default=None, max_length=200)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = "processedAt"
    sort_desc: bool = True


# ── Tool call frames (for Nova Lite) ──────────────────────────
class ToolResult(BaseModel):
    tool_name: str
    result: dict
    citations: list[Citation] = []
