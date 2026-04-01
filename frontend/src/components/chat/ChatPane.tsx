"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Sparkles, X, Command, Home } from "lucide-react";
import { ChatBubble, SuggestedPrompts } from "@/components/chat/ChatBubble";
import { EmailViewerModal } from "@/components/ui/EmailViewerModal";
import { useChatStore, useEvidenceStore } from "@/lib/store";
import type { Citation } from "@/lib/types";
import { nanoid } from "@/lib/utils";

const FINX_NOVA_BADGE = (
    <div className="flex items-center gap-1.5 px-2.5 py-1 glass rounded-full text-xs">
        <Sparkles size={10} className="text-violet-400" />
        <span className="gradient-text font-semibold tracking-wide">Powered by Amazon Nova</span>
    </div>
);

async function streamChat(
    userMessage: string,
    history: { role: string; content: { text: string }[] }[],
    auditMode: boolean,
    onChunk: (chunk: string) => void,
    onCitations: (citations: Citation[]) => void,
    onToolStart: (tool: string) => void,
    onDone: () => void,
    onError: () => void
) {
    try {
        const res = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: userMessage,
                conversation_history: history,
                audit_mode: auditMode,
            }),
        });

        if (!res.ok || !res.body) { onError(); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") { onDone(); return; }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === "chunk") onChunk(parsed.text);
                    if (parsed.type === "citations") onCitations(parsed.citations);
                    if (parsed.type === "tool_start") onToolStart(parsed.tool);
                    if (parsed.type === "done") { onDone(); return; }
                } catch { /* skip non-JSON lines */ }
            }
        }
        onDone();
    } catch {
        onError();
    }
}


export default function ChatPane() {
    const { messages, addMessage, updateMessage, clearChat } = useChatStore();
    const { openEvidence } = useEvidenceStore();
    const [input, setInput] = useState("");
    const [isAuditMode, setIsAuditMode] = useState(false);
    const [emailViewerInvoice, setEmailViewerInvoice] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    const handleCitationClick = useCallback(
        async (citation: Citation) => {
            if ((citation.type === "invoice" || citation.type === "attachment") && citation.s3Key) {
                try {
                    const res = await fetch(`/api/download?s3_key=${encodeURIComponent(citation.s3Key)}`);
                    if (!res.ok) throw new Error("Failed to get signed URL");
                    const data = await res.json();
                    
                    const a = document.createElement("a");
                    a.href = data.signed_url;
                    a.download = citation.s3Key.split("/").pop() || "document.pdf";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } catch (error) {
                    console.error("Failed to download:", error);
                }
            } else {
                console.log("No downloadable file for citation:", citation);
            }
        },
        []
    );

    const handleSend = useCallback(async (overrideText?: string) => {
        const text = (overrideText ?? input).trim();
        if (!text) return;

        if (!overrideText) setInput("");
        else setInput("");
        textareaRef.current?.focus();

        const historyForApi = messages
            .filter((m) => m.role !== "system" && m.content)
            .slice(-10)
            .map((m) => ({
                role: m.role,
                content: [{ text: m.content }],
            }));

        // Add user message
        addMessage({ role: "user", content: text });

        // Add assistant placeholder
        const assistantId = addMessage({ role: "assistant", content: "", isStreaming: true });

        scrollToBottom();

        let accContent = "";

        await streamChat(
            isAuditMode ? `[AUDIT MODE] ${text}` : text,
            historyForApi,
            isAuditMode,
            (chunk) => {
                accContent += chunk;
                updateMessage(assistantId, { content: accContent, isStreaming: true });
                scrollToBottom();
            },
            (citations) => {
                updateMessage(assistantId, { citations });
            },
            (tool) => {
                // Show which Nova Lite tool is being called
                updateMessage(assistantId, {
                    content: accContent,
                    isStreaming: true,
                    toolCalls: [{ name: tool, args: {} }],
                });
            },
            () => {
                updateMessage(assistantId, { isStreaming: false, toolCalls: [] });
            },
            () => {
                updateMessage(assistantId, {
                    content: accContent || "Sorry, something went wrong. Please try again.",
                    isStreaming: false,
                });
            }
        );

    }, [input, isAuditMode, addMessage, updateMessage]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend(undefined);
        }
    };

    const isEmpty = messages.length === 0;

    return (
        <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-finx-border shrink-0">
                <div className="flex items-center gap-3">
                    {FINX_NOVA_BADGE}
                    {/* Audit mode toggle */}
                    <button
                        onClick={() => setIsAuditMode((v) => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all duration-200 ${isAuditMode
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            : "glass text-finx-text-dim hover:text-finx-text"
                            }`}
                    >
                        <span className="font-medium">
                            {isAuditMode ? "🔍 Audit Mode On" : "Audit Mode"}
                        </span>
                    </button>
                </div>

                {messages.length > 0 && (
                    <button
                        onClick={clearChat}
                        className="p-1.5 glass rounded-lg text-finx-text-dim hover:text-finx-text transition-colors"
                        title="Back to home"
                    >
                        <Home size={13} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
                {/* Empty state */}
                <AnimatePresence>
                    {isEmpty && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col items-center justify-center h-full gap-6 text-center pt-16"
                        >
                            <div className="relative">
                                <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 glow-accent">
                                    <Sparkles size={28} className="text-white" />
                                </div>
                                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-[#060a12] flex items-center justify-center text-xs">
                                    ✓
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-finx-text mb-1.5 glow-text">
                                    FinX Invoice Copilot
                                </h2>
                                <p className="text-sm text-finx-text-muted max-w-xs leading-relaxed">
                                    Ask me anything about your invoices — search, detect fraud, retrieve email
                                    evidence, or explore your AP pipeline.
                                </p>
                            </div>
                            <SuggestedPrompts
                                onPrompt={(p) => {
                                    handleSend(p);
                                }}
                            />
                            <div className="flex items-center gap-1.5 text-xs text-finx-text-dim">
                                <Command size={10} />
                                <span>K for command bar</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actual messages */}
                {messages.map((msg) => (
                    <ChatBubble
                        key={msg.id}
                        message={msg}
                        onCitationClick={handleCitationClick}
                        onEmailView={setEmailViewerInvoice}
                    />
                ))}

                <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="shrink-0 px-4 pb-4">
                <div className="glass rounded-[var(--radius-card)] p-3 transition-all duration-200 focus-within:border-indigo-500/40 focus-within:glow-accent">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about invoices, fraud, or vendors… (Shift+Enter for newline)"
                        className="w-full bg-transparent text-sm text-finx-text placeholder:text-finx-text-dim resize-none focus:outline-none leading-relaxed min-h-[20px] max-h-[160px]"
                    />
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-finx-border">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-finx-text-dim">Nova Lite</span>
                            <span className="text-xs text-slate-700">·</span>
                            <span className="text-xs text-finx-text-dim">Enter to send</span>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="w-8 h-8 gradient-brand rounded-xl flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all active:scale-95 shadow-md shadow-indigo-500/25"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Email Viewer Modal */}
            {emailViewerInvoice !== null && (
                <EmailViewerModal
                    invoiceNumber={emailViewerInvoice}
                    onClose={() => setEmailViewerInvoice(null)}
                />
            )}
        </div>
    );
}
