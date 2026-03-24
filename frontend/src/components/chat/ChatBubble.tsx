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
}

export function ChatBubble({ message, onCitationClick }: ChatBubbleProps) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center my-2"
            >
                <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-slate-400">
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
                    "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white mt-0.5",
                    isUser
                        ? "gradient-brand"
                        : "bg-indigo-500/20 border border-indigo-500/30"
                )}
            >
                {isUser ? <User size={13} /> : <Bot size={13} className="text-indigo-300" />}
            </div>

            {/* Bubble */}
            <div className={cn("flex flex-col gap-2 max-w-[85%]", isUser ? "items-end" : "items-start")}>
                <div
                    className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        isUser
                            ? "gradient-brand text-white rounded-tr-sm shadow-lg shadow-indigo-500/20"
                            : "glass text-slate-200 rounded-tl-sm"
                    )}
                >
                    {message.isStreaming && !message.content ? (
                        <ThinkingDots />
                    ) : (
                        <MessageContent
                            content={message.content}
                            isStreaming={message.isStreaming}
                        />
                    )}
                </div>

                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                            {message.citations.map((c) => (
                                <CitationBadge
                                    key={c.id}
                                    citation={c}
                                    onClick={() => onCitationClick?.(c)}
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
                <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity px-1">
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
}: {
    content: string;
    isStreaming?: boolean;
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
                elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
                tableLines = [];
                inTable = false;
            }
            if (line.trim().length > 0 || isStreaming) {
                elements.push(<span key={i}>{line}<br /></span>);
            }
        }
    }

    if (inTable) {
        elements.push(<MarkdownTable key={`table-end`} lines={tableLines} />);
    }

    return (
        <span className={cn("whitespace-pre-wrap", isStreaming && "typing-cursor")}>
            {elements}
        </span>
    );
}

function MarkdownTable({ lines }: { lines: string[] }) {
    if (lines.length < 2) return <pre>{lines.join('\n')}</pre>;

    const headers = lines[0].split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    const bodyRows = lines.slice(2).map(row =>
        row.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
    );

    return (
        <div className="overflow-x-auto my-3 w-full">
            <table className="min-w-full divide-y divide-indigo-500/20 border border-indigo-500/20 rounded-lg overflow-hidden text-sm">
                <thead className="bg-indigo-500/10">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-semibold text-indigo-300 uppercase tracking-wider">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-indigo-500/10">
                    {bodyRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-slate-300 whitespace-nowrap">{cell}</td>
                            ))}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md glass text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md glass text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
}

const CITATION_ICONS: Record<Citation["type"], React.ReactNode> = {
    invoice: <FileText size={10} />,
    email: <Mail size={10} />,
    attachment: <ExternalLink size={10} />,
    case: <AlertCircle size={10} />,
};

const CITATION_COLORS: Record<Citation["type"], string> = {
    invoice: "bg-indigo-500/12 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20",
    email: "bg-violet-500/12 border-violet-500/25 text-violet-300 hover:bg-violet-500/20",
    attachment: "bg-amber-500/12 border-amber-500/25 text-amber-300 hover:bg-amber-500/20",
    case: "bg-rose-500/12 border-rose-500/25 text-rose-300 hover:bg-rose-500/20",
};

export function CitationBadge({ citation, onClick }: CitationBadgeProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono transition-colors duration-150 cursor-pointer",
                CITATION_COLORS[citation.type]
            )}
            title={citation.s3Key}
        >
            {CITATION_ICONS[citation.type]}
            {citation.label}
        </button>
    );
}


// ── Suggested prompts ─────────────────────────────────────────
const SUGGESTED_PROMPTS = [
    "Show me forged invoices",
    "Duplicates from last 30 days",
    "Top vendors by invoice volume",
    "Show unprocessed raw invoices",
    "Invoices flagged with GST mismatch",
    "Fraud station — open high risk cases",
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
                    className="px-3 py-1.5 text-xs glass rounded-full text-slate-400 hover:text-slate-200 hover:border-white/16 transition-all duration-180 cursor-pointer"
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
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg text-xs text-slate-400">
            <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            {labels[name] ?? `Running ${name}…`}
        </div>
    );
}
