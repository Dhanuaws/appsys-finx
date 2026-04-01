"use client";

import { motion } from "framer-motion";
import { cn, formatDateTime } from "@/lib/utils";
import { ThinkingDots } from "@/components/ui/invoice-widgets";
import { Bot, User, FileText, Mail, ExternalLink, AlertCircle, Download, Archive, Loader2 } from "lucide-react";
import type { ChatMessage, Citation } from "@/lib/types";
import { useState } from "react";

// ── Chat Bubble ───────────────────────────────────────────────
interface ChatBubbleProps {
    message: ChatMessage;
    onCitationClick?: (citation: Citation) => void;
    onEmailView?: (invoiceNumber: string) => void;
}

export function ChatBubble({ message, onCitationClick, onEmailView }: ChatBubbleProps) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center my-2"
            >
                <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-finx-text-muted">
                    <AlertCircle size={12} />
                    {message.content}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
                "flex gap-3 group",
                isUser ? "flex-row-reverse" : "flex-row"
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    "shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
                    isUser
                        ? "gradient-brand text-white"
                        : "bg-finx-surface-hover border border-finx-border text-finx-accent-1"
                )}
            >
                {isUser ? <User size={13} /> : <Bot size={13} />}
            </div>

            {/* Bubble */}
            <div className={cn("flex flex-col gap-2 max-w-[85%]", isUser ? "items-end" : "items-start")}>
                <div
                    className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        isUser
                            ? "gradient-brand text-white rounded-tr-sm glow-accent"
                            : "glass text-finx-text rounded-tl-sm"
                    )}
                >
                    {message.isStreaming && !message.content ? (
                        <ThinkingDots />
                    ) : (
                        <MessageContent
                            content={message.content}
                            isStreaming={message.isStreaming}
                            citations={message.citations}
                            onEmailView={onEmailView}
                        />
                    )}
                </div>

                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                            {Array.from(new Map(message.citations.map(c => [c.id, c])).values()).map((c, i) => (
                                <CitationBadge
                                    key={`${c.id}-${i}`}
                                    citation={c}
                                    onClick={() => onCitationClick?.(c)}
                                    onEmailView={onEmailView}
                                />
                            ))}
                        </div>

                        {/* Download Actions (only if we have s3 keys and it's a finished assistant msg) */}
                        {!message.isStreaming && !isUser && (
                            <DownloadActions citations={message.citations} />
                        )}
                    </div>
                )}

                {/* Timestamp */}
                <span className="text-xs text-finx-text-dim opacity-0 group-hover:opacity-100 transition-opacity px-1">
                    {formatDateTime(message.timestamp)}
                </span>
            </div>
        </motion.div>
    );
}


import React from "react";

// ── Streaming text with cursor ────────────────────────────────
function MessageContent({
    content,
    isStreaming,
    citations,
    onEmailView,
}: {
    content: string;
    isStreaming?: boolean;
    citations?: Citation[];
    onEmailView?: (invoiceNumber: string) => void;
}) {
    // Final cleanup of any stray citation bracket string
    const cleanedContent = content.replace(/\[[a-z]+:[^\]]+\]/g, "");

    // Simple inline Markdown Table Parser
    const lines = cleanedContent.split('\n');
    const elements: React.ReactNode[] = [];
    let tableLines: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            inTable = true;
            tableLines.push(line);
        } else {
            if (inTable) {
                elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} onEmailView={onEmailView} />);
                tableLines = [];
                inTable = false;
            }
            if (line.trim().length > 0 || isStreaming) {
                elements.push(<span key={i}>{line}<br /></span>);
            }
        }
    }

    if (inTable) {
        elements.push(<MarkdownTable key={`table-end`} lines={tableLines} onEmailView={onEmailView} />);
    }

    return (
        <span className={cn("whitespace-pre-wrap", isStreaming && "typing-cursor")}>
            {elements}
        </span>
    );
}

function MarkdownTable({ lines, onEmailView }: { lines: string[]; onEmailView?: (invoiceNumber: string) => void }) {
    if (lines.length < 2) return <pre>{lines.join('\n')}</pre>;

    const headers = lines[0].split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    const bodyRows = lines.slice(2).map(row =>
        row.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
    );

    // Detect invoice-related column
    const invoiceColIndex = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes("invoice number") || lower.includes("invoice no") || lower.startsWith("invoice");
    });
    const hasInvoiceCol = invoiceColIndex >= 0 && !!onEmailView;

    return (
        <div className="overflow-x-auto my-3 w-full">
            <table className="min-w-full divide-y divide-finx-border border border-finx-border rounded-lg overflow-hidden text-sm">
                <thead className="bg-finx-surface">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-semibold text-finx-text-muted uppercase tracking-wider">{h}</th>
                        ))}
                        {hasInvoiceCol && (
                            <th key="email-header" className="px-3 py-2 text-left font-semibold text-finx-text-muted uppercase tracking-wider">Email</th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-finx-border border-b border-finx-border">
                    {bodyRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-finx-surface-hover transition-colors">
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-finx-text max-w-[280px] break-words whitespace-normal">{cell}</td>
                            ))}
                            {hasInvoiceCol && (
                                <td key="email-action" className="px-3 py-2">
                                    <button
                                        onClick={() => onEmailView?.(row[invoiceColIndex])}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                                        title="View email evidence"
                                    >
                                        <Mail size={10} />
                                        Email
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Download Actions ──────────────────────────────────────────
function DownloadActions({ citations }: { citations: Citation[] }) {
    const [downloading, setDownloading] = useState<string | null>(null);

    // Extract valid invoice citations with s3 keys
    const invoices = citations.filter(c => (c.type === "invoice" || c.type === "attachment") && c.s3Key);

    if (invoices.length === 0) return null;

    // Remove duplicates based on s3Key
    const uniqueInvoices = Array.from(new Map(invoices.map(item => [item.s3Key, item])).values());

    const handleIndividualDownload = async (citation: Citation) => {
        try {
            setDownloading(citation.id);
            const res = await fetch(`/api/download?s3_key=${encodeURIComponent(citation.s3Key!)}`);
            if (!res.ok) throw new Error("Failed to get signed URL");
            const data = await res.json();

            // Trigger download via hidden anchor
            const a = document.createElement("a");
            a.href = data.signed_url;
            a.download = citation.s3Key!.split("/").pop() || "document.pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Failed to download:", error);
        } finally {
            setDownloading(null);
        }
    };

    const handleBulkDownload = async () => {
        try {
            setDownloading("bulk-zip");
            const s3Keys = uniqueInvoices.map(c => c.s3Key!);

            const res = await fetch(`${process.env.NEXT_PUBLIC_FINX_API_URL}/invoices/download-zip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ s3_keys: s3Keys })
            });

            if (!res.ok) throw new Error("Failed to generate zip");

            // Handle blob download
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `finx_invoices_${new Date().toISOString().split("T")[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Failed to download zip:", error);
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="flex flex-wrap gap-2 mt-1">
            {uniqueInvoices.length > 3 ? (
                <button
                    onClick={handleBulkDownload}
                    disabled={downloading !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md glass text-xs font-medium text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover hover:border-finx-border-strong transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {downloading === "bulk-zip" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
                    Download All Invoices (.zip)
                </button>
            ) : (
                uniqueInvoices.map(inv => (
                    <button
                        key={inv.id}
                        onClick={() => handleIndividualDownload(inv)}
                        disabled={downloading !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md glass text-xs font-medium text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Download ${inv.label}`}
                    >
                        {downloading === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        {inv.label}
                    </button>
                ))
            )}
        </div>
    );
}


// ── Citation Badge ────────────────────────────────────────────
interface CitationBadgeProps {
    citation: Citation;
    onClick?: () => void;
    onEmailView?: (invoiceNumber: string) => void;
}

const CITATION_ICONS: Record<Citation["type"], React.ReactNode> = {
    invoice: <FileText size={10} />,
    email: <Mail size={10} />,
    attachment: <ExternalLink size={10} />,
    case: <AlertCircle size={10} />,
};

const CITATION_COLORS: Record<Citation["type"], string> = {
    invoice: "bg-finx-surface border-finx-border text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover hover:border-finx-border-strong",
    email: "bg-finx-surface border-finx-border text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover hover:border-finx-border-strong",
    attachment: "bg-finx-surface border-finx-border text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover hover:border-finx-border-strong",
    case: "bg-finx-surface border-finx-border text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover hover:border-finx-border-strong",
};

export function CitationBadge({ citation, onClick, onEmailView }: CitationBadgeProps) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (citation.type === "email") {
            onEmailView?.(citation.label); // label is the invoice number for email citations
            return;
        }
        if ((citation.type === "invoice" || citation.type === "attachment") && citation.s3Key) {
            setLoading(true);
            try {
                const res = await fetch(`/api/download?s3_key=${encodeURIComponent(citation.s3Key)}`);
                const data = await res.json();
                if (data.signed_url) window.open(data.signed_url, "_blank", "noopener,noreferrer");
            } catch (e) {
                console.error("Failed to open file:", e);
            } finally {
                setLoading(false);
            }
        }
        onClick?.();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono transition-colors duration-150 cursor-pointer disabled:opacity-60",
                CITATION_COLORS[citation.type]
            )}
            title={citation.s3Key}
        >
            {loading ? <Loader2 size={10} className="animate-spin" /> : CITATION_ICONS[citation.type]}
            {citation.label}
        </button>
    );
}


// ── Suggested prompts ─────────────────────────────────────────
const SUGGESTED_PROMPTS = [
    "Show me all processed invoices so far",
    "Show me all the processed invoices today",
    "Are there any duplicated invoices today",
    "Show me all the processed invoices this week",
    "Are there any duplicated invoices this week",
    "Show unprocessed raw invoices",
    "Invoices flagged with GST mismatch",
    "Top vendors by invoices",
];

interface SuggestedPromptsProps {
    onPrompt: (prompt: string) => void;
}

export function SuggestedPrompts({ onPrompt }: SuggestedPromptsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap justify-center gap-2 px-4"
        >
            {SUGGESTED_PROMPTS.map((p) => (
                <button
                    key={p}
                    type="button"
                    onClick={() => onPrompt(p)}
                    className="px-3 py-1.5 text-xs glass rounded-full text-finx-text-muted hover:text-finx-text hover:border-finx-border-strong transition-all duration-180 cursor-pointer"
                >
                    {p}
                </button>
            ))}
        </motion.div>
    );
}


// ── Tool call indicator ───────────────────────────────────────
export function ToolCallIndicator({ name }: { name: string }) {
    const labels: Record<string, string> = {
        SearchInvoices: "Searching invoices…",
        GetInvoice: "Fetching invoice details…",
        ListForgedInvoices: "Scanning for forged invoices…",
        GetEmailEvidenceByInvoice: "Retrieving email evidence…",
        GetSignedAttachmentUrl: "Preparing attachment…",
    };

    return (
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg text-xs text-finx-text-muted">
            <span className="w-3 h-3 border-2 border-finx-accent-1 border-t-transparent rounded-full animate-spin" />
            {labels[name] ?? `Running ${name}…`}
        </div>
    );
}
