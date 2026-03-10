// ============================================================
// FinX Shared Types
// ============================================================

// --- RBAC ---
export type Role = "AP_CLERK" | "APPROVER" | "CONTROLLER" | "AUDITOR" | "ADMIN";

export interface UserSession {
    userId: string;
    tenantId: string;
    email: string;
    name: string;
    role: Role;
    canViewEmails: boolean;
    piiAccess: boolean;
    canApprovePayments: boolean;
    maxApprovalLimit: number;
    entityIds: string[];
    costCenters: string[];
    vendorIds: string[];
}

// --- Invoice ---
export type InvoiceStatus = "RAW" | "DUPLICATE" | "SUCCESS" | "FORGED";

export interface InvoiceLine {
    LineNumber: number;
    LineType: string;
    LineAmount: number;
    Description: string;
    AccountingDate: string;
    TaxControlAmount: number;
}

export interface Invoice {
    invoiceId: string;
    tenantId: string;
    invoiceNumber: string;
    vendorId: string;
    vendorName: string;
    entityId: string;
    invoiceDate: string;
    amount: number;
    currency: string;
    status: InvoiceStatus;
    exceptionCodes: string[];
    duplicateOfInvoiceId?: string;
    fraudScore?: number;
    fraudReasons?: string[];
    documentRef?: string;
    linkedEmailIds?: string[];
    processedAt: string;
    invoiceLines?: InvoiceLine[];
    s3Location?: string;
    processingStatus?: string;
}

// --- Email Evidence ---
export interface EmailAttachment {
    attachmentId: string;
    name: string;
    mimeType: string;
    s3Key: string;
    sizeBytes: number;
    signedUrl?: string;
}

export interface EmailEvidence {
    emailId: string;
    tenantId: string;
    sender: string;
    date: string;
    subject: string;
    bodySnippet: string;
    body?: string;
    attachments: EmailAttachment[];
    linkedInvoiceIds: string[];
    s3Key: string;
}

// --- Fraud Case ---
export type CaseStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";
export type CaseSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FraudCase {
    caseId: string;
    tenantId: string;
    invoiceId: string;
    invoice?: Invoice;
    status: CaseStatus;
    severity: CaseSeverity;
    assignee?: string;
    comments: CaseComment[];
    createdAt: string;
    updatedAt: string;
    slaDeadline?: string;
    evidenceRefs: string[];
    resolution?: string;
}

export interface CaseComment {
    commentId: string;
    author: string;
    text: string;
    createdAt: string;
    mentions?: string[];
}

// --- Chat ---
export type MessageRole = "user" | "assistant" | "system";

export interface Citation {
    type: "invoice" | "email" | "attachment" | "case";
    id: string;
    label: string;
    s3Key?: string;
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    citations?: Citation[];
    toolCalls?: ToolCall[];
    isStreaming?: boolean;
    timestamp: Date;
}

export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
}

// --- Filters ---
export interface InvoiceFilters {
    dateFrom?: string;
    dateTo?: string;
    status?: InvoiceStatus[];
    vendorId?: string;
    entityId?: string;
    fraudScoreMin?: number;
    amountMin?: number;
    amountMax?: number;
    exceptionCodes?: string[];
    search?: string;
}

// --- API ---
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}
