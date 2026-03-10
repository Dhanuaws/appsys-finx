"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldAlert, Filter, Plus, Clock, CheckCircle2,
    AlertTriangle, Eye, ArrowRight, Sparkles, Users,
} from "lucide-react";
import { Card, Button, Divider, SectionLabel, Skeleton } from "@/components/ui/primitives";
import {
    FraudScoreMeter, ReasonTags, StatusBadge, SeverityBadge, AmountDisplay, CaseTimeline,
} from "@/components/ui/invoice-widgets";
import { useFraudStore } from "@/lib/store";
import { formatDate, timeAgo } from "@/lib/utils";
import type { FraudCase, CaseSeverity } from "@/lib/types";
import Navbar from "@/components/layout/Navbar";

// ── Mock data for hackathon demo ──────────────────────────────
const MOCK_CASES: FraudCase[] = [
    {
        caseId: "CASE-001",
        tenantId: "tenant-appsys",
        invoiceId: "INV-001",
        status: "OPEN",
        severity: "CRITICAL",
        assignee: "Alice Chen",
        createdAt: "2026-03-08T10:00:00Z",
        updatedAt: "2026-03-10T09:00:00Z",
        slaDeadline: "2026-03-11T23:59:00Z",
        evidenceRefs: ["email-001", "att-invoice.pdf"],
        comments: [],
        invoice: {
            invoiceId: "INV-001", tenantId: "tenant-appsys",
            invoiceNumber: "INV-2024-8871",
            vendorName: "Lee Supplies Ltd",
            vendorId: "v-lee",
            entityId: "GLOBAL-AP",
            invoiceDate: "2026-03-07",
            amount: 48500.00,
            currency: "USD",
            status: "FORGED",
            exceptionCodes: ["DOMAIN_MISMATCH", "BANK_CHANGE"],
            fraudScore: 92,
            fraudReasons: ["Sender domain mismatch", "Bank account recently changed", "Invoice template anomaly"],
            processedAt: "2026-03-08T10:00:00Z",
        },
    },
    {
        caseId: "CASE-002",
        tenantId: "tenant-appsys",
        invoiceId: "INV-002",
        status: "IN_REVIEW",
        severity: "HIGH",
        assignee: "Bob Martinez",
        createdAt: "2026-03-07T14:00:00Z",
        updatedAt: "2026-03-09T12:00:00Z",
        evidenceRefs: ["email-002"],
        comments: [],
        invoice: {
            invoiceId: "INV-002", tenantId: "tenant-appsys",
            invoiceNumber: "DUP-2024-3390",
            vendorName: "Premier Tech Services",
            vendorId: "v-pts",
            entityId: "EMEA-AP",
            invoiceDate: "2026-03-05",
            amount: 12750.00,
            currency: "EUR",
            status: "DUPLICATE",
            exceptionCodes: ["DUPLICATE_HASH"],
            fraudScore: 71,
            fraudReasons: ["Duplicate hash detected", "Amount outlier vs vendor avg"],
            processedAt: "2026-03-07T14:00:00Z",
        },
    },
    {
        caseId: "CASE-003",
        tenantId: "tenant-appsys",
        invoiceId: "INV-003",
        status: "OPEN",
        severity: "MEDIUM",
        createdAt: "2026-03-06T08:00:00Z",
        updatedAt: "2026-03-06T08:00:00Z",
        evidenceRefs: [],
        comments: [],
        invoice: {
            invoiceId: "INV-003", tenantId: "tenant-appsys",
            invoiceNumber: "EXP-2024-0172",
            vendorName: "Nexus Office Supplies",
            vendorId: "v-nexus",
            entityId: "APAC-AP",
            invoiceDate: "2026-03-04",
            amount: 3200.00,
            currency: "SGD",
            status: "RAW",
            exceptionCodes: ["GST_MISMATCH"],
            fraudScore: 44,
            fraudReasons: ["GST amount mismatch", "New vendor with high volume"],
            processedAt: "2026-03-06T08:00:00Z",
        },
    },
];

const SEVERITY_ORDER: CaseSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function FraudStationPage() {
    const { cases, setCases, selectedCase, selectCase } = useFraudStore();
    const [loading, setLoading] = useState(true);
    const [severityFilter, setSeverityFilter] = useState<CaseSeverity | "ALL">("ALL");

    useEffect(() => {
        // In production, fetch from /api/backend/fraud-cases
        setTimeout(() => {
            setCases(MOCK_CASES);
            setLoading(false);
        }, 800);
    }, [setCases]);

    const filtered = cases.filter(
        (c) => severityFilter === "ALL" || c.severity === severityFilter
    );

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Navbar />

            <div className="flex flex-1 overflow-hidden">
                {/* ── Case Queue ── */}
                <div className="w-[340px] shrink-0 border-r border-white/6 flex flex-col h-full">
                    {/* Queue Header */}
                    <div className="px-4 py-4 border-b border-white/6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-rose-500/20 border border-rose-500/30 rounded-lg flex items-center justify-center">
                                    <ShieldAlert size={12} className="text-rose-400" />
                                </div>
                                <h1 className="text-sm font-semibold text-slate-200">Fraud Station</h1>
                                <span className="px-1.5 py-0.5 text-xs bg-rose-500/15 border border-rose-500/25 text-rose-400 rounded-full">
                                    {cases.filter(c => c.status === "OPEN").length} open
                                </span>
                            </div>
                            <Button variant="glass" size="xs" icon={<Plus size={12} />}>
                                New
                            </Button>
                        </div>

                        {/* Severity filter chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {["ALL", ...SEVERITY_ORDER].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSeverityFilter(s as CaseSeverity | "ALL")}
                                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 ${severityFilter === s
                                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                            : "glass text-slate-500 hover:text-slate-300"
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Case list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="glass rounded-xl p-4 space-y-2.5">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-400/40" />
                                No {severityFilter !== "ALL" ? severityFilter.toLowerCase() : ""} cases. Great work!
                            </div>
                        ) : (
                            <AnimatePresence>
                                {filtered.map((c) => (
                                    <motion.div
                                        key={c.caseId}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                    >
                                        <CaseCard
                                            case_={c}
                                            selected={selectedCase?.caseId === c.caseId}
                                            onClick={() => selectCase(c)}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* ── Case Detail ── */}
                <div className="flex-1 h-full overflow-y-auto p-6">
                    {!selectedCase ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center">
                                <ShieldAlert size={28} className="text-rose-400/60" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-300 mb-1">Fraud Station</h2>
                                <p className="text-sm text-slate-500 max-w-xs">
                                    Select a case from the queue to investigate evidence, assign reviewers, and resolve fraud flags.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <CaseDetail case_={selectedCase} />
                    )}
                </div>
            </div>
        </div>
    );
}


// ── Case Card (queue item) ────────────────────────────────────
function CaseCard({ case_: c, selected, onClick }: { case_: FraudCase; selected: boolean; onClick: () => void }) {
    const inv = c.invoice;
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left glass rounded-xl p-3.5 transition-all duration-200 space-y-2.5 border ${selected
                    ? "border-indigo-500/40 bg-indigo-500/8 shadow-md shadow-indigo-500/10"
                    : "hover:border-white/14 hover:bg-white/4"
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <SeverityBadge severity={c.severity} />
                        <span className="text-xs text-slate-500 font-mono">{c.caseId}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 truncate">{inv?.vendorName ?? "Unknown"}</p>
                    <p className="text-xs font-mono text-slate-500">{inv?.invoiceNumber}</p>
                </div>
                {inv?.fraudScore !== undefined && (
                    <FraudScoreMeter score={inv.fraudScore} size={44} showLabel={false} />
                )}
            </div>

            {inv?.amount !== undefined && (
                <AmountDisplay amount={inv.amount} currency={inv.currency} className="text-xs text-slate-300" />
            )}

            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{timeAgo(c.createdAt)}</span>
                {c.assignee && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Users size={10} />
                        {c.assignee}
                    </div>
                )}
            </div>

            {c.status === "OPEN" && c.slaDeadline && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                    <Clock size={10} />
                    SLA: {formatDate(c.slaDeadline)}
                </div>
            )}
        </button>
    );
}


// ── Case Detail View ──────────────────────────────────────────
function CaseDetail({ case_: c }: { case_: FraudCase }) {
    const inv = c.invoice;

    return (
        <motion.div
            key={c.caseId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto space-y-5"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <SeverityBadge severity={c.severity} />
                        <span className="text-xs font-mono text-slate-500">{c.caseId}</span>
                        <span
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${c.status === "OPEN"
                                    ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                                    : c.status === "IN_REVIEW"
                                        ? "bg-blue-500/10 border-blue-500/25 text-blue-400"
                                        : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                                }`}
                        >
                            {c.status.replace("_", " ")}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{inv?.vendorName ?? "Unknown Vendor"}</h2>
                    <p className="text-sm text-slate-400 mt-1">{inv?.invoiceNumber} · {inv?.entityId}</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="glass" size="sm" icon={<Users size={13} />}>
                        Assign
                    </Button>
                    <Button variant="danger" size="sm" icon={<ShieldAlert size={13} />}>
                        Escalate
                    </Button>
                    <Button variant="primary" size="sm" icon={<CheckCircle2 size={13} />}>
                        Resolve
                    </Button>
                </div>
            </div>

            {inv && (
                <div className="grid grid-cols-3 gap-4">
                    {/* Invoice details card */}
                    <Card className="col-span-2 space-y-4">
                        <SectionLabel>Invoice Details</SectionLabel>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            {[
                                { label: "Amount", value: <AmountDisplay amount={inv.amount} currency={inv.currency} className="text-emerald-400" /> },
                                { label: "Invoice Date", value: formatDate(inv.invoiceDate) },
                                { label: "Currency", value: inv.currency },
                                { label: "Status", value: <StatusBadge status={inv.status} /> },
                                { label: "Entity", value: inv.entityId },
                                { label: "Vendor ID", value: <span className="font-mono">{inv.vendorId}</span> },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-slate-500 mb-1">{label}</p>
                                    <div className="text-slate-200">{value as React.ReactNode}</div>
                                </div>
                            ))}
                        </div>

                        <Divider />

                        <div>
                            <SectionLabel>Fraud Signals</SectionLabel>
                            <div className="flex items-center gap-6">
                                <FraudScoreMeter score={inv.fraudScore ?? 0} size={72} />
                                <div className="flex-1">
                                    <ReasonTags reasons={inv.fraudReasons ?? []} maxVisible={5} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Quick actions */}
                    <Card className="space-y-3">
                        <SectionLabel>Quick Actions</SectionLabel>
                        <div className="space-y-2">
                            {[
                                { label: "View Email Evidence", icon: <Eye size={12} /> },
                                { label: "Ask Nova AI", icon: <Sparkles size={12} /> },
                                { label: "Create AP Hold", icon: <AlertTriangle size={12} /> },
                                { label: "Request Verification", icon: <ArrowRight size={12} /> },
                            ].map(({ label, icon }) => (
                                <button
                                    key={label}
                                    className="w-full flex items-center gap-2 px-3 py-2 glass rounded-lg text-xs text-slate-300 hover:text-white hover:border-white/14 transition-all text-left"
                                >
                                    <span className="text-indigo-400">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            {/* Timeline */}
            <Card>
                <SectionLabel className="mb-3">Case Timeline</SectionLabel>
                <CaseTimeline
                    events={[
                        { label: "Case opened", time: formatDate(c.createdAt), status: "done" },
                        { label: "Fraud signals detected by Nova Lite", time: formatDate(c.createdAt), status: "done" },
                        ...(c.assignee ? [{ label: `Assigned to ${c.assignee}`, time: formatDate(c.updatedAt), status: "done" as const }] : []),
                        { label: c.status === "RESOLVED" ? "Case resolved" : "Awaiting resolution", time: c.status === "RESOLVED" ? formatDate(c.updatedAt) : "Pending", status: c.status === "RESOLVED" ? "done" as const : "pending" as const },
                    ]}
                />
            </Card>
        </motion.div>
    );
}
