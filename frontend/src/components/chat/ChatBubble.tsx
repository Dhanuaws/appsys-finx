"use client";

import { motion } from "framer-motion";
import { cn, formatDateTime } from "@/lib/utils";
import { ThinkingDots } from "@/components/ui/invoice-widgets";
import { Bot, User, FileText, Mail, ExternalLink, AlertCircle } from "lucide-react";
import type { ChatMessage, Citation } from "@/lib/types";

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
                    <div className="flex flex-wrap gap-1.5">
                        {message.citations.map((c) => (
                            <CitationBadge
                                key={c.id}
                                citation={c}
                                onClick={() => onCitationClick?.(c)}
                            />
                        ))}
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


// ── Streaming text with cursor ────────────────────────────────
function MessageContent({
    content,
    isStreaming,
}: {
    content: string;
    isStreaming?: boolean;
}) {
    return (
        <span className={cn("whitespace-pre-wrap", isStreaming && "typing-cursor")}>
            {content}
        </span>
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
