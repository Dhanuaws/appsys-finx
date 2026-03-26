"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import {
    X, Mail, Paperclip, ExternalLink, FileText,
    Calendar, User, Hash, Shield, ShieldAlert, Download,
} from "lucide-react";
import { useEvidenceStore } from "@/lib/store";
import { FraudScoreMeter, ReasonTags, StatusBadge, CaseTimeline, ExceptionChips, AmountDisplay } from "@/components/ui/invoice-widgets";
import { Card, Divider, Skeleton, SectionLabel, Button } from "@/components/ui/primitives";
import { formatDate, formatBytes, truncate } from "@/lib/utils";

async function fetchEmailEvidence(invoiceId: string) {
    const res = await fetch(`/api/backend/evidence/${invoiceId}`);
    if (!res.ok) return null;
    return res.json();
}

export default function EvidencePanel() {
    const { selectedInvoice, emailEvidence, isOpen, isLoading, setEmailEvidence, close } = useEvidenceStore();

    useEffect(() => {
        if (selectedInvoice && isOpen) {
            fetchEmailEvidence(selectedInvoice.invoiceId)
                .then((ev) => setEmailEvidence(ev))
                .catch(() => setEmailEvidence(null));
        }
    }, [selectedInvoice, isOpen, setEmailEvidence]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    key="evidence-panel"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="flex flex-col h-full overflow-y-auto border-l border-finx-border"
                    aria-label="Evidence Panel"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-finx-border shrink-0">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-indigo-400" />
                            <span className="text-xs font-semibold text-finx-text">Evidence</span>
                        </div>
                        <button
                            onClick={close}
                            className="p-1 glass rounded-lg text-finx-text-dim hover:text-finx-text transition-colors"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                        {!selectedInvoice ? (
                            <div className="text-center text-finx-text-dim text-sm pt-12">
                                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                                Select an invoice to view evidence
                            </div>
                        ) : (
                            <>
                                {/* Invoice Summary Card */}
                                <InvoiceSummaryCard invoice={selectedInvoice} />

                                <Divider />

                                {/* Email Evidence */}
                                <section>
                                    <SectionLabel>Email Evidence</SectionLabel>
                                    {isLoading ? (
                                        <EmailSkeleton />
                                    ) : emailEvidence ? (
                                        <EmailEvidenceCard evidence={emailEvidence} />
                                    ) : (
                                        <div className="glass rounded-xl p-4 text-center text-xs text-finx-text-dim">
                                            <Mail size={20} className="mx-auto mb-2 opacity-30" />
                                            No linked email evidence found for this invoice.
                                        </div>
                                    )}
                                </section>

                                {/* Fraud Signals */}
                                {selectedInvoice.fraudScore !== undefined && (
                                    <>
                                        <Divider />
                                        <section>
                                            <SectionLabel>Fraud Signals</SectionLabel>
                                            <Card className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <FraudScoreMeter score={selectedInvoice.fraudScore} />
                                                    <div className="flex-1">
                                                        <p className="text-xs text-finx-text-muted mb-2">Detected reasons</p>
                                                        <ReasonTags reasons={selectedInvoice.fraudReasons ?? []} />
                                                    </div>
                                                </div>
                                            </Card>
                                        </section>
                                    </>
                                )}

                                {/* Audit Timeline */}
                                <Divider />
                                <section>
                                    <SectionLabel>Audit Timeline</SectionLabel>
                                    <CaseTimeline
                                        events={[
                                            { label: "Email Received & Ingested", time: formatDate(selectedInvoice.invoiceDate), status: "done" },
                                            { label: "Attachment Parsed by Lambda 1", time: formatDate(selectedInvoice.invoiceDate), status: "done" },
                                            { label: "Data Extracted (Nova Lite)", time: formatDate(selectedInvoice.processedAt), status: "done" },
                                            {
                                                label: selectedInvoice.status === "SUCCESS" ? "Invoice Approved" :
                                                    selectedInvoice.status === "DUPLICATE" ? "Flagged: Duplicate" :
                                                        selectedInvoice.status === "FORGED" ? "Flagged: Suspicious" : "Awaiting Processing",
                                                time: formatDate(selectedInvoice.processedAt),
                                                status: selectedInvoice.status === "SUCCESS" ? "done" :
                                                    (selectedInvoice.status === "RAW" ? "pending" : "active"),
                                            },
                                        ]}
                                    />
                                </section>
                            </>
                        )}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}


// ── Invoice Summary ───────────────────────────────────────────
function InvoiceSummaryCard({ invoice }: { invoice: NonNullable<ReturnType<typeof useEvidenceStore.getState>["selectedInvoice"]> }) {
    return (
        <Card className="space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs text-finx-text-dim font-mono">#{invoice.invoiceNumber}</p>
                    <p className="font-semibold text-slate-100 mt-0.5">{invoice.vendorName}</p>
                </div>
                <StatusBadge status={invoice.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <p className="text-finx-text-dim mb-0.5">Amount</p>
                    <AmountDisplay amount={invoice.amount} currency={invoice.currency} className="text-emerald-400 text-sm" />
                </div>
                <div>
                    <p className="text-finx-text-dim mb-0.5">Date</p>
                    <p className="text-finx-text">{formatDate(invoice.invoiceDate)}</p>
                </div>
                <div>
                    <p className="text-finx-text-dim mb-0.5">Entity</p>
                    <p className="text-finx-text truncate">{invoice.entityId || "—"}</p>
                </div>
                <div>
                    <p className="text-finx-text-dim mb-0.5">Currency</p>
                    <p className="text-finx-text">{invoice.currency}</p>
                </div>
            </div>
            {invoice.exceptionCodes?.length > 0 && (
                <ExceptionChips codes={invoice.exceptionCodes} />
            )}
            {invoice.duplicateOfInvoiceId && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <Hash size={11} />
                    Duplicate of: <span className="font-mono">{invoice.duplicateOfInvoiceId}</span>
                </div>
            )}
        </Card>
    );
}


// ── Email Evidence Card ───────────────────────────────────────
function EmailEvidenceCard({ evidence }: { evidence: import("@/lib/types").EmailEvidence }) {
    return (
        <div className="space-y-3">
            <Card className="space-y-3">
                <div className="flex items-start gap-2">
                    <div className="w-7 h-7 bg-violet-500/15 border border-violet-500/25 rounded-lg flex items-center justify-center shrink-0">
                        <Mail size={13} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-finx-text truncate">{evidence.subject}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <User size={10} className="text-finx-text-dim" />
                            <p className="text-xs text-finx-text-muted truncate">{evidence.sender}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Calendar size={10} className="text-finx-text-dim" />
                            <p className="text-xs text-finx-text-dim">{formatDate(evidence.date)}</p>
                        </div>
                    </div>
                </div>

                {/* Body snippet */}
                {evidence.bodySnippet && (
                    <div className="bg-white/3 rounded-lg px-3 py-2 text-xs text-finx-text-muted leading-relaxed border-l-2 border-violet-500/30">
                        {truncate(evidence.bodySnippet, 240)}
                    </div>
                )}
            </Card>

            {/* Attachments */}
            {evidence.attachments?.length > 0 && (
                <div>
                    <SectionLabel>Attachments ({evidence.attachments.length})</SectionLabel>
                    <div className="space-y-2">
                        {evidence.attachments.map((att) => (
                            <div
                                key={att.attachmentId}
                                className="glass rounded-xl px-3 py-2.5 flex items-center gap-3"
                            >
                                <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                                    <Paperclip size={12} className="text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-finx-text truncate">{att.name}</p>
                                    <p className="text-xs text-finx-text-dim mt-0.5">
                                        {att.mimeType} · {formatBytes(att.sizeBytes)}
                                    </p>
                                </div>
                                {att.signedUrl ? (
                                    <a
                                        href={att.signedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 glass rounded-lg text-finx-text-muted hover:text-finx-text hover:border-white/20 transition-colors"
                                        title="Open attachment"
                                    >
                                        <ExternalLink size={12} />
                                    </a>
                                ) : (
                                    <div className="p-1.5 rounded-lg text-finx-text-dim" title="Access restricted">
                                        <Shield size={12} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


// ── Skeleton ──────────────────────────────────────────────────
function EmailSkeleton() {
    return (
        <div className="space-y-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-16 w-full mt-3" />
            <Skeleton className="h-10 w-full" />
        </div>
    );
}
