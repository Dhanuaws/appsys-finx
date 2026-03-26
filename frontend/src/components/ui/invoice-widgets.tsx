"use client";

import { motion } from "framer-motion";
import { cn, fraudScoreColor, fraudScoreLabel, STATUS_CONFIG, SEVERITY_CONFIG } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import type { InvoiceStatus, CaseSeverity } from "@/lib/types";
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

// ── FraudScore Radial Meter ───────────────────────────────────
interface FraudScoreMeterProps {
    score: number;
    size?: number;
    showLabel?: boolean;
}

export function FraudScoreMeter({ score, size = 64, showLabel = true }: FraudScoreMeterProps) {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = fraudScoreColor(score);

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={6}
                    />
                    <motion.circle
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth={6}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold tabular-nums" style={{ color }}>
                        {score}
                    </span>
                </div>
            </div>
            {showLabel && (
                <span className="text-xs font-medium" style={{ color }}>
                    {fraudScoreLabel(score)}
                </span>
            )}
        </div>
    );
}


// ── Fraud Reason Tags ─────────────────────────────────────────
interface ReasonTagsProps {
    reasons: string[];
    maxVisible?: number;
}

export function ReasonTags({ reasons, maxVisible = 3 }: ReasonTagsProps) {
    const visible = reasons.slice(0, maxVisible);
    const rest = reasons.length - visible.length;

    return (
        <div className="flex flex-wrap gap-1.5">
            {visible.map((r) => (
                <span
                    key={r}
                    className="px-2 py-0.5 text-xs rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400"
                >
                    {r}
                </span>
            ))}
            {rest > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-md bg-finx-surface border border-finx-border text-finx-text-muted">
                    +{rest} more
                </span>
            )}
        </div>
    );
}


// ── Status Badge ──────────────────────────────────────────────
export function StatusBadge({ status }: { status: InvoiceStatus }) {
    const cfg = STATUS_CONFIG[status];
    return (
        <Badge className={cfg.bg} dot={cfg.dot}>
            <span className={cfg.color}>{cfg.label}</span>
        </Badge>
    );
}


// ── Severity Badge ────────────────────────────────────────────
export function SeverityBadge({ severity }: { severity: CaseSeverity }) {
    const cfg = SEVERITY_CONFIG[severity];
    const icons: Record<CaseSeverity, React.ReactNode> = {
        LOW: <ShieldCheck size={11} />,
        MEDIUM: <AlertTriangle size={11} />,
        HIGH: <ShieldAlert size={11} />,
        CRITICAL: <ShieldAlert size={11} />,
    };
    return (
        <Badge className={cn(cfg.bg, cfg.color, "gap-1")}>
            {icons[severity]}
            {cfg.label}
        </Badge>
    );
}


// ── Case Timeline ─────────────────────────────────────────────
interface TimelineEvent {
    label: string;
    time: string;
    status?: "done" | "active" | "pending";
}

export function CaseTimeline({ events }: { events: TimelineEvent[] }) {
    return (
        <ol className="relative pl-5 space-y-4">
            {events.map((ev, i) => (
                <li key={i} className="relative">
                    <span
                        className={cn(
                            "absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full border-2",
                            ev.status === "done"
                                ? "bg-emerald-400 border-emerald-600"
                                : ev.status === "active"
                                    ? "bg-indigo-400 border-indigo-600 animate-pulse"
                                    : "bg-slate-700 border-slate-600"
                        )}
                    />
                    {i < events.length - 1 && (
                        <span className="absolute -left-[14px] top-4 w-px h-full bg-white/8" />
                    )}
                    <p className="text-xs font-medium text-finx-text">{ev.label}</p>
                    <p className="text-xs text-finx-text-dim mt-0.5">{ev.time}</p>
                </li>
            ))}
        </ol>
    );
}


// ── Exception Code Chips ──────────────────────────────────────
export function ExceptionChips({ codes }: { codes: string[] }) {
    return (
        <div className="flex flex-wrap gap-1">
            {codes.map((code) => (
                <span
                    key={code}
                    className="px-2 py-0.5 text-xs rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono"
                >
                    {code}
                </span>
            ))}
        </div>
    );
}


// ── Pulse dot (live indicator) ────────────────────────────────
export function PulseDot({ color = "bg-emerald-400" }: { color?: string }) {
    return (
        <span className="relative flex h-2 w-2">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", color)} />
            <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
        </span>
    );
}


// ── Loading dots ──────────────────────────────────────────────
export function ThinkingDots() {
    return (
        <span className="flex items-center gap-1 px-1">
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                />
            ))}
        </span>
    );
}


// ── Amount display with currency ──────────────────────────────
export function AmountDisplay({
    amount, currency = "USD", className,
}: {
    amount: number; currency?: string; className?: string;
}) {
    return (
        <span className={cn("font-mono tabular-nums font-semibold", className)}>
            {new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)}
        </span>
    );
}
