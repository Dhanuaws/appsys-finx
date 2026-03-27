"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldAlert, Filter, Plus, Clock, CheckCircle2,
    AlertTriangle, Eye, ArrowRight, Sparkles, Users,
    X, Loader2,
} from "lucide-react";
import { Card, Button, Divider, SectionLabel, Skeleton } from "@/components/ui/primitives";
import {
    FraudScoreMeter, ReasonTags, StatusBadge, SeverityBadge, AmountDisplay, CaseTimeline,
} from "@/components/ui/invoice-widgets";
import { useFraudStore } from "@/lib/store";
import { formatDate, timeAgo } from "@/lib/utils";
import type { FraudCase, CaseSeverity } from "@/lib/types";
import Navbar from "@/components/layout/Navbar";

const SEVERITY_ORDER: CaseSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

// ── API helpers ───────────────────────────────────────────────
async function fetchCases(): Promise<FraudCase[]> {
    const res = await fetch("/api/proxy/fraud-cases");
    if (!res.ok) throw new Error(`Failed to load cases: ${res.status}`);
    const data = await res.json();
    return data.items ?? [];
}

async function patchCase(caseId: string, updates: Record<string, string | undefined>): Promise<FraudCase> {
    const res = await fetch(`/api/proxy/fraud-cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    return res.json();
}

async function createCase(payload: { invoice_id: string; severity: string; reason: string }): Promise<FraudCase> {
    const res = await fetch("/api/proxy/fraud-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    return res.json();
}

// ── Page ──────────────────────────────────────────────────────
export default function FraudStationPage() {
    const router = useRouter();
    const { cases, setCases, selectedCase, selectCase } = useFraudStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [severityFilter, setSeverityFilter] = useState<CaseSeverity | "ALL">("ALL");
    const [actionPending, setActionPending] = useState<string | null>(null);
    const [showNewCaseModal, setShowNewCaseModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);

    const loadCases = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const items = await fetchCases();
            setCases(items);
            // Re-select the current case with fresh data if it was already selected
            if (selectedCase) {
                const refreshed = items.find((c) => c.caseId === selectedCase.caseId);
                if (refreshed) selectCase(refreshed);
            }
        } catch (err) {
            setError("Unable to load fraud cases. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [setCases, selectCase, selectedCase]);

    useEffect(() => {
        loadCases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAction = useCallback(
        async (action: "resolve" | "escalate", caseId: string) => {
            setActionPending(action);
            try {
                const updates =
                    action === "resolve"
                        ? { status: "RESOLVED" }
                        : { severity: "CRITICAL", status: "IN_REVIEW" };
                const updated = await patchCase(caseId, updates);
                setCases(cases.map((c) => (c.caseId === caseId ? { ...c, ...updated } : c)));
                if (selectedCase?.caseId === caseId) selectCase({ ...selectedCase, ...updated });
            } catch {
                // silently ignore — user can retry
            } finally {
                setActionPending(null);
            }
        },
        [cases, selectedCase, setCases, selectCase]
    );

    const handleAssign = useCallback(
        async (caseId: string, assignee: string) => {
            setActionPending("assign");
            try {
                const updated = await patchCase(caseId, { assignee, status: "IN_REVIEW" });
                setCases(cases.map((c) => (c.caseId === caseId ? { ...c, ...updated } : c)));
                if (selectedCase?.caseId === caseId) selectCase({ ...selectedCase, ...updated });
            } catch {
                // silently ignore
            } finally {
                setActionPending(null);
                setShowAssignModal(false);
            }
        },
        [cases, selectedCase, setCases, selectCase]
    );

    const handleAskNova = (invoiceId: string, vendorName: string) => {
        router.push(`/?q=Tell+me+about+invoice+${invoiceId}+for+${encodeURIComponent(vendorName)}`);
    };

    const filtered = cases.filter(
        (c) => severityFilter === "ALL" || c.severity === severityFilter
    );

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Navbar />

            <div className="flex flex-1 overflow-hidden">
                {/* ── Case Queue ── */}
                <div className="w-[340px] shrink-0 border-r border-white/6 flex flex-col h-full">
                    <div className="px-4 py-4 border-b border-white/6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-rose-500/20 border border-rose-500/30 rounded-lg flex items-center justify-center">
                                    <ShieldAlert size={12} className="text-rose-400" />
                                </div>
                                <h1 className="text-sm font-semibold text-slate-200">Fraud Station</h1>
                                <span className="px-1.5 py-0.5 text-xs bg-rose-500/15 border border-rose-500/25 text-rose-400 rounded-full">
                                    {cases.filter((c) => c.status === "OPEN").length} open
                                </span>
                            </div>
                            <Button
                                variant="glass"
                                size="xs"
                                icon={<Plus size={12} />}
                                onClick={() => setShowNewCaseModal(true)}
                            >
                                New
                            </Button>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                            {["ALL", ...SEVERITY_ORDER].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSeverityFilter(s as CaseSeverity | "ALL")}
                                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-150 ${
                                        severityFilter === s
                                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                            : "glass text-slate-500 hover:text-slate-300"
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="glass rounded-xl p-4 space-y-2.5">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ))
                        ) : error ? (
                            <div className="text-center py-12 space-y-3">
                                <p className="text-sm text-rose-400">{error}</p>
                                <button
                                    onClick={loadCases}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                                >
                                    Retry
                                </button>
                            </div>
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
                        <CaseDetail
                            case_={selectedCase}
                            actionPending={actionPending}
                            onResolve={() => handleAction("resolve", selectedCase.caseId)}
                            onEscalate={() => handleAction("escalate", selectedCase.caseId)}
                            onAssign={() => setShowAssignModal(true)}
                            onAskNova={() =>
                                handleAskNova(
                                    selectedCase.invoice?.invoiceNumber ?? selectedCase.invoiceId,
                                    selectedCase.invoice?.vendorName ?? "vendor"
                                )
                            }
                        />
                    )}
                </div>
            </div>

            {/* ── New Case Modal ── */}
            <AnimatePresence>
                {showNewCaseModal && (
                    <NewCaseModal
                        onClose={() => setShowNewCaseModal(false)}
                        onCreate={async (payload) => {
                            try {
                                const newCase = await createCase(payload);
                                setCases([newCase, ...cases]);
                                setShowNewCaseModal(false);
                            } catch {
                                // let modal handle error display
                                throw new Error("Failed to create case");
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ── Assign Modal ── */}
            <AnimatePresence>
                {showAssignModal && selectedCase && (
                    <AssignModal
                        caseId={selectedCase.caseId}
                        currentAssignee={selectedCase.assignee}
                        onClose={() => setShowAssignModal(false)}
                        onAssign={handleAssign}
                        pending={actionPending === "assign"}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


// ── Case Card ─────────────────────────────────────────────────
function CaseCard({ case_: c, selected, onClick }: { case_: FraudCase; selected: boolean; onClick: () => void }) {
    const inv = c.invoice;
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left glass rounded-xl p-3.5 transition-all duration-200 space-y-2.5 border ${
                selected
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
                    <p className="text-xs font-mono text-slate-500">{inv?.invoiceNumber ?? c.invoiceId}</p>
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


// ── Case Detail ───────────────────────────────────────────────
function CaseDetail({
    case_: c,
    actionPending,
    onResolve,
    onEscalate,
    onAssign,
    onAskNova,
}: {
    case_: FraudCase;
    actionPending: string | null;
    onResolve: () => void;
    onEscalate: () => void;
    onAssign: () => void;
    onAskNova: () => void;
}) {
    const inv = c.invoice;
    const isResolved = c.status === "RESOLVED";

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
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                c.status === "OPEN"
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
                    <p className="text-sm text-slate-400 mt-1">
                        {inv?.invoiceNumber ?? c.invoiceId} · {inv?.entityId}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="glass"
                        size="sm"
                        icon={actionPending === "assign" ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                        onClick={onAssign}
                        disabled={isResolved || actionPending !== null}
                    >
                        Assign
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        icon={actionPending === "escalate" ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
                        onClick={onEscalate}
                        disabled={isResolved || actionPending !== null}
                    >
                        Escalate
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={actionPending === "resolve" ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        onClick={onResolve}
                        disabled={isResolved || actionPending !== null}
                    >
                        {isResolved ? "Resolved" : "Resolve"}
                    </Button>
                </div>
            </div>

            {inv && (
                <div className="grid grid-cols-3 gap-4">
                    {/* Invoice details */}
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
                            <QuickActionButton
                                label="View Email Evidence"
                                icon={<Eye size={12} />}
                                onClick={() => {
                                    // Navigate to dashboard with the invoice pre-queried
                                    window.location.href = `/dashboard?q=${encodeURIComponent(`Get email evidence for invoice ${inv.invoiceNumber ?? c.invoiceId}`)}`;
                                }}
                            />
                            <QuickActionButton
                                label="Ask Nova AI"
                                icon={<Sparkles size={12} />}
                                onClick={onAskNova}
                            />
                            <QuickActionButton
                                label="Create AP Hold"
                                icon={<AlertTriangle size={12} />}
                                onClick={() => alert(`AP Hold feature coming soon for ${inv.invoiceNumber}`)}
                            />
                            <QuickActionButton
                                label="Request Verification"
                                icon={<ArrowRight size={12} />}
                                onClick={() => alert(`Verification request sent for ${inv.invoiceNumber}`)}
                            />
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
                        ...(c.assignee
                            ? [{ label: `Assigned to ${c.assignee}`, time: formatDate(c.updatedAt), status: "done" as const }]
                            : []),
                        {
                            label: c.status === "RESOLVED" ? "Case resolved" : "Awaiting resolution",
                            time: c.status === "RESOLVED" ? formatDate(c.updatedAt) : "Pending",
                            status: c.status === "RESOLVED" ? ("done" as const) : ("pending" as const),
                        },
                    ]}
                />
            </Card>
        </motion.div>
    );
}

function QuickActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-2 px-3 py-2 glass rounded-lg text-xs text-slate-300 hover:text-white hover:border-white/14 transition-all text-left"
        >
            <span className="text-indigo-400">{icon}</span>
            {label}
        </button>
    );
}


// ── New Case Modal ────────────────────────────────────────────
function NewCaseModal({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (payload: { invoice_id: string; severity: string; reason: string }) => Promise<void>;
}) {
    const [invoiceId, setInvoiceId] = useState("");
    const [severity, setSeverity] = useState("MEDIUM");
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!invoiceId.trim()) { setErr("Invoice ID is required."); return; }
        setPending(true);
        setErr(null);
        try {
            await onCreate({ invoice_id: invoiceId.trim(), severity, reason });
        } catch {
            setErr("Failed to create case. Please try again.");
        } finally {
            setPending(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="glass rounded-2xl p-6 w-full max-w-md space-y-4 border border-white/10"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-200">Open New Fraud Case</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Invoice ID</label>
                        <input
                            type="text"
                            placeholder="e.g. INV-2024-8871"
                            value={invoiceId}
                            onChange={(e) => setInvoiceId(e.target.value)}
                            className="w-full glass rounded-lg px-3 py-2 text-xs text-finx-text placeholder:text-finx-text-dim focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Severity</label>
                        <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value)}
                            className="w-full glass rounded-lg px-3 py-2 text-xs text-finx-text focus:outline-none bg-transparent"
                        >
                            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Reason / Notes</label>
                        <textarea
                            rows={3}
                            placeholder="Describe the fraud signals observed…"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full glass rounded-lg px-3 py-2 text-xs text-finx-text placeholder:text-finx-text-dim focus:outline-none resize-none"
                        />
                    </div>
                    {err && <p className="text-xs text-rose-400">{err}</p>}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        onClick={handleSubmit}
                        disabled={pending}
                    >
                        {pending ? "Creating…" : "Create Case"}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}


// ── Assign Modal ──────────────────────────────────────────────
function AssignModal({
    caseId,
    currentAssignee,
    onClose,
    onAssign,
    pending,
}: {
    caseId: string;
    currentAssignee?: string;
    onClose: () => void;
    onAssign: (caseId: string, assignee: string) => void;
    pending: boolean;
}) {
    const [name, setName] = useState(currentAssignee ?? "");

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="glass rounded-2xl p-6 w-full max-w-sm space-y-4 border border-white/10"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-200">Assign Case</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div>
                    <label className="text-xs text-slate-400 block mb-1">Assignee Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Alice Chen"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full glass rounded-lg px-3 py-2 text-xs text-finx-text placeholder:text-finx-text-dim focus:outline-none"
                        autoFocus
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={pending ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
                        onClick={() => name.trim() && onAssign(caseId, name.trim())}
                        disabled={pending || !name.trim()}
                    >
                        {pending ? "Assigning…" : "Assign"}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}
