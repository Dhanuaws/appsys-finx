import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import type { InvoiceStatus, CaseSeverity } from "./types";

// ── Class merge util ──────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// ── Status → styling ─────────────────────────────────────────
export const STATUS_CONFIG: Record<
    InvoiceStatus,
    { label: string; color: string; bg: string; dot: string }
> = {
    RAW: {
        label: "Raw",
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/25",
        dot: "bg-amber-400",
    },
    DUPLICATE: {
        label: "Duplicate",
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/25",
        dot: "bg-red-400",
    },
    SUCCESS: {
        label: "Success",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/25",
        dot: "bg-emerald-400",
    },
    FORGED: {
        label: "Forged",
        color: "text-rose-400",
        bg: "bg-rose-500/10 border-rose-500/25",
        dot: "bg-rose-400",
    },
};

// ── Severity → styling ────────────────────────────────────────
export const SEVERITY_CONFIG: Record<
    CaseSeverity,
    { label: string; color: string; bg: string }
> = {
    LOW: { label: "Low", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
    MEDIUM: { label: "Medium", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/25" },
    HIGH: { label: "High", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25" },
    CRITICAL: { label: "Critical", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/25" },
};

// ── Fraud score colour ────────────────────────────────────────
export function fraudScoreColor(score: number): string {
    if (score < 25) return "#10b981"; // green
    if (score < 55) return "#f59e0b"; // amber
    if (score < 80) return "#ef4444"; // red
    return "#f43f5e";                  // rose/critical
}

export function fraudScoreLabel(score: number): string {
    if (score < 25) return "Clean";
    if (score < 55) return "Suspicious";
    if (score < 80) return "High Risk";
    return "Critical";
}

// ── Formatting ────────────────────────────────────────────────
export function formatAmount(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
    }).format(amount);
}

export function formatDate(date: string | Date): string {
    return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
    return format(new Date(date), "dd MMM yyyy, HH:mm");
}

export function timeAgo(date: string | Date): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Generate unique IDs ───────────────────────────────────────
export function nanoid(len = 10): string {
    return Math.random().toString(36).slice(2, 2 + len);
}

// ── Truncate text ─────────────────────────────────────────────
export function truncate(str: string, n: number): string {
    return str.length > n ? `${str.slice(0, n)}…` : str;
}

// ── Date range presets ────────────────────────────────────────
export type DatePreset = "today" | "7d" | "30d" | "month" | "year" | "custom";

export function getDateRange(preset: DatePreset): { from: string; to: string } {
    const now = new Date();
    const to = format(now, "yyyy-MM-dd");
    const from = (d: Date) => format(d, "yyyy-MM-dd");

    const presets: Record<DatePreset, () => { from: string; to: string }> = {
        today: () => ({ from: to, to }),
        "7d": () => ({ from: from(new Date(Date.now() - 7 * 864e5)), to }),
        "30d": () => ({ from: from(new Date(Date.now() - 30 * 864e5)), to }),
        month: () => ({ from: from(new Date(now.getFullYear(), now.getMonth(), 1)), to }),
        year: () => ({ from: from(new Date(now.getFullYear(), 0, 1)), to }),
        custom: () => ({ from: "", to }),
    };

    return presets[preset]();
}
