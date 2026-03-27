"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
    Calendar, ChevronDown, Search, SlidersHorizontal,
    RotateCcw, Bookmark, Building2, Users, Filter,
} from "lucide-react";
import { Button, Chip, Divider, SectionLabel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/invoice-widgets";
import { useFilterStore } from "@/lib/store";
import { getDateRange, type DatePreset } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/types";

// ── Date preset tabs ──────────────────────────────────────────
const DATE_PRESETS: { label: string; value: DatePreset }[] = [
    { label: "Today", value: "today" },
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
];

const STATUSES: InvoiceStatus[] = ["RAW", "DUPLICATE", "SUCCESS", "FORGED"];

const EXCEPTION_CODES = [
    "GST_MISMATCH", "AMOUNT_OUTLIER", "DOMAIN_MISMATCH",
    "DKIM_FAILED", "BANK_CHANGE", "DUPLICATE_HASH",
];

// ── Filter Pane ───────────────────────────────────────────────
export default function FilterPane() {
    const { filters, datePreset, setFilter, setDatePreset, resetFilters } = useFilterStore();
    const [amountExpanded, setAmountExpanded] = useState(false);
    const [exceptionExpanded, setExceptionExpanded] = useState(false);

    const activeStatusList = (filters.status ?? []) as InvoiceStatus[];

    // SUCCESS, FORGED, DUPLICATE are mutually exclusive — only one at a time.
    // RAW can be combined freely with any of the three.
    const EXCLUSIVE_STATUSES: InvoiceStatus[] = ["SUCCESS", "FORGED", "DUPLICATE"];

    const toggleStatus = (s: InvoiceStatus) => {
        if (s === "RAW") {
            const next = activeStatusList.includes("RAW")
                ? activeStatusList.filter((x) => x !== "RAW")
                : [...activeStatusList, "RAW"];
            setFilter("status", next.length ? next : undefined);
        } else {
            // Clicking an exclusive status: deselect if already active,
            // otherwise select it and clear the other two exclusive statuses.
            if (activeStatusList.includes(s)) {
                const next = activeStatusList.filter((x) => x !== s);
                setFilter("status", next.length ? next : undefined);
            } else {
                const next = [
                    ...activeStatusList.filter((x) => !EXCLUSIVE_STATUSES.includes(x)),
                    s,
                ];
                setFilter("status", next.length ? next : undefined);
            }
        }
    };

    const toggleException = (code: string) => {
        const current = filters.exceptionCodes ?? [];
        const next = current.includes(code)
            ? current.filter((c) => c !== code)
            : [...current, code];
        setFilter("exceptionCodes", next.length ? next : undefined);
    };

    const handleDatePreset = (p: DatePreset) => {
        const { from, to } = getDateRange(p);
        setDatePreset(p, from, to);
    };

    return (
        <aside className="flex flex-col h-full overflow-y-auto gap-5 p-4 text-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-finx-text-muted" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-finx-text-muted">
                        Filters
                    </span>
                </div>
                <Button variant="ghost" size="xs" onClick={resetFilters} icon={<RotateCcw size={12} />}>
                    Reset
                </Button>
            </div>

            <Divider />

            {/* Search */}
            <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-finx-text-dim" />
                <input
                    type="text"
                    placeholder="Search invoices…"
                    value={filters.search ?? ""}
                    onChange={(e) => setFilter("search", e.target.value || undefined)}
                    className="w-full glass rounded-lg pl-8 pr-3 py-2 text-xs text-finx-text placeholder:text-finx-text-dim focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
            </div>

            {/* Date Range */}
            <section>
                <SectionLabel>Date Range</SectionLabel>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {DATE_PRESETS.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => handleDatePreset(p.value)}
                            className={`py-1.5 text-xs rounded-md border transition-all duration-150 ${datePreset === p.value
                                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                    : "glass text-finx-text-muted hover:text-finx-text"
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        onClick={() => handleDatePreset("custom")}
                        className={`col-span-3 py-1.5 text-xs rounded-md border flex items-center justify-center gap-1.5 transition-all duration-150 ${datePreset === "custom"
                                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                                : "glass text-finx-text-muted hover:text-finx-text"
                            }`}
                    >
                        <Calendar size={11} />
                        Custom range
                    </button>
                </div>

                {/* Custom date inputs */}
                <AnimatePresence>
                    {datePreset === "custom" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden space-y-2"
                        >
                            <div>
                                <label className="text-xs text-finx-text-dim mb-1 block">From</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom ?? ""}
                                    onChange={(e) => setFilter("dateFrom", e.target.value || undefined)}
                                    className="w-full glass rounded-lg px-3 py-1.5 text-xs text-finx-text focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-finx-text-dim mb-1 block">To</label>
                                <input
                                    type="date"
                                    value={filters.dateTo ?? ""}
                                    onChange={(e) => setFilter("dateTo", e.target.value || undefined)}
                                    className="w-full glass rounded-lg px-3 py-1.5 text-xs text-finx-text focus:outline-none"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            <Divider />

            {/* Status */}
            <section>
                <SectionLabel>Status</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                    {STATUSES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => toggleStatus(s)}
                            className={`py-1.5 px-2 rounded-lg border text-xs flex items-center gap-1.5 transition-all duration-150 ${activeStatusList.includes(s)
                                    ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                                    : "glass text-finx-text-muted hover:text-finx-text"
                                }`}
                        >
                            <StatusBadge status={s} />
                        </button>
                    ))}
                </div>
            </section>

            <Divider />

            {/* Vendor / Entity */}
            <section>
                <SectionLabel>Vendor / Entity</SectionLabel>
                <div className="space-y-2">
                    <div className="relative">
                        <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-finx-text-dim" />
                        <input
                            type="text"
                            placeholder="Filter by vendor…"
                            value={filters.vendorId ?? ""}
                            onChange={(e) => setFilter("vendorId", e.target.value || undefined)}
                            className="w-full glass rounded-lg pl-8 pr-3 py-2 text-xs text-finx-text placeholder:text-finx-text-dim focus:outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Users size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-finx-text-dim" />
                        <input
                            type="text"
                            placeholder="Filter by entity…"
                            value={filters.entityId ?? ""}
                            onChange={(e) => setFilter("entityId", e.target.value || undefined)}
                            className="w-full glass rounded-lg pl-8 pr-3 py-2 text-xs text-finx-text placeholder:text-finx-text-dim focus:outline-none"
                        />
                    </div>
                </div>
            </section>

            <Divider />

            {/* Fraud Score */}
            <section>
                <SectionLabel>Min Fraud Score</SectionLabel>
                <div className="flex items-center gap-3">
                    <input
                        type="range" min={0} max={100} step={5}
                        value={filters.fraudScoreMin ?? 0}
                        onChange={(e) => setFilter("fraudScoreMin", Number(e.target.value) || undefined)}
                        className="flex-1 accent-indigo-500"
                    />
                    <span className="text-xs font-mono text-indigo-300 w-8 text-right">
                        {filters.fraudScoreMin ?? 0}
                    </span>
                </div>
            </section>

            {/* Amount Range */}
            <section>
                <button
                    className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-widest text-finx-text-muted mb-2"
                    onClick={() => setAmountExpanded((v) => !v)}
                >
                    Amount Range
                    <ChevronDown
                        size={13}
                        className={`transition-transform duration-200 ${amountExpanded ? "rotate-180" : ""}`}
                    />
                </button>
                <AnimatePresence>
                    {amountExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden grid grid-cols-2 gap-2"
                        >
                            <div>
                                <label className="text-xs text-finx-text-dim">Min ($)</label>
                                <input
                                    type="number" placeholder="0"
                                    value={filters.amountMin ?? ""}
                                    onChange={(e) => setFilter("amountMin", Number(e.target.value) || undefined)}
                                    className="w-full glass rounded-lg px-2 py-1.5 text-xs mt-1 focus:outline-none text-finx-text"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-finx-text-dim">Max ($)</label>
                                <input
                                    type="number" placeholder="∞"
                                    value={filters.amountMax ?? ""}
                                    onChange={(e) => setFilter("amountMax", Number(e.target.value) || undefined)}
                                    className="w-full glass rounded-lg px-2 py-1.5 text-xs mt-1 focus:outline-none text-finx-text"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            <Divider />

            {/* Exception codes */}
            <section>
                <button
                    className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-widest text-finx-text-muted mb-2"
                    onClick={() => setExceptionExpanded((v) => !v)}
                >
                    Exception Codes
                    <ChevronDown
                        size={13}
                        className={`transition-transform duration-200 ${exceptionExpanded ? "rotate-180" : ""}`}
                    />
                </button>
                <AnimatePresence>
                    {exceptionExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden flex flex-wrap gap-1.5 pt-1"
                        >
                            {EXCEPTION_CODES.map((code) => (
                                <Chip
                                    key={code}
                                    active={(filters.exceptionCodes ?? []).includes(code)}
                                    onClick={() => toggleException(code)}
                                >
                                    {code}
                                </Chip>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {/* Save View */}
            <div className="mt-auto pt-4">
                <button className="w-full py-2 glass rounded-lg text-xs text-finx-text-muted hover:text-finx-text hover:border-finx-border-strong transition-colors flex items-center justify-center gap-2">
                    <Bookmark size={12} />
                    Save this view
                </button>
            </div>
        </aside>
    );
}
