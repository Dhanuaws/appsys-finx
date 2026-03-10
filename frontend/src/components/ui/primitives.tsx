"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "ghost" | "glass" | "danger" | "outline";
    size?: "xs" | "sm" | "md" | "lg";
    loading?: boolean;
    icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "ghost", size = "md", loading, icon, children, className, disabled, ...props }, ref) => {
        const base =
            "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer select-none rounded-[var(--radius-btn)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60";

        const variants = {
            primary:
                "gradient-brand text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:brightness-110 active:scale-[0.97]",
            ghost:
                "text-slate-300 hover:text-white hover:bg-white/6 active:bg-white/10",
            glass:
                "glass text-slate-200 hover:bg-white/8 hover:border-white/14 active:scale-[0.98]",
            danger:
                "bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 active:scale-[0.97]",
            outline:
                "border border-white/12 text-slate-300 hover:border-white/24 hover:text-white active:scale-[0.98]",
        };

        const sizes = {
            xs: "px-2 py-1 text-xs gap-1",
            sm: "px-3 py-1.5 text-sm",
            md: "px-4 py-2 text-sm",
            lg: "px-5 py-2.5 text-base",
        };

        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={cn(base, variants[variant], sizes[size], className)}
                {...props}
            >
                {loading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : icon ? (
                    <span className="shrink-0">{icon}</span>
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";


// ── Badge ─────────────────────────────────────────────────────
interface BadgeProps {
    children: React.ReactNode;
    className?: string;
    dot?: string; // dot colour class e.g. "bg-emerald-400"
}

export function Badge({ children, className, dot }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md border",
                className
            )}
        >
            {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />}
            {children}
        </span>
    );
}


// ── Card ──────────────────────────────────────────────────────
interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "glass rounded-[var(--radius-card)] p-4",
                hover &&
                "transition-all duration-200 hover:bg-white/7 hover:border-white/14 hover:shadow-lg cursor-pointer",
                className
            )}
        >
            {children}
        </div>
    );
}


// ── Chip / filter pill ────────────────────────────────────────
interface ChipProps {
    children: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
    onRemove?: () => void;
    className?: string;
}

export function Chip({ children, active, onClick, onRemove, className }: ChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-[var(--radius-chip)] border transition-all duration-180 cursor-pointer",
                active
                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                    : "glass text-slate-400 hover:text-slate-200 hover:border-white/16",
                className
            )}
        >
            {children}
            {onRemove && (
                <span
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="ml-0.5 opacity-60 hover:opacity-100 text-xs"
                >
                    ×
                </span>
            )}
        </button>
    );
}


// ── Skeleton loader ───────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn("shimmer rounded-lg", className)}
            aria-hidden="true"
        />
    );
}


// ── Divider ───────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
    return (
        <div
            className={cn("h-px bg-white/6 w-full", className)}
            role="separator"
        />
    );
}


// ── Section heading ───────────────────────────────────────────
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn("text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2", className)}>
            {children}
        </p>
    );
}


// ── Tooltip wrapper (pure CSS, no JS) ─────────────────────────
export function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <span className="group relative inline-flex">
            {children}
            <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-slate-800 border border-white/10 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
            >
                {label}
            </span>
        </span>
    );
}
