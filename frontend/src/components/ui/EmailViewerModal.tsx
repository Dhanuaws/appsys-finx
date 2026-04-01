"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Paperclip, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface EmailAttachment {
    name: string;
    s3Key: string;
    signedUrl: string | null;
    rejected: boolean;
    rejectReason: string | null;
}

interface EmailData {
    messageId: string;
    subject: string;
    sender: string;
    receivedDate: string;
    status: string;
    vendorName: string;
    invoiceNumber: string;
    rawEmailUrl: string | null;
    body: string | null;
    attachments: EmailAttachment[];
}

interface EmailViewerModalProps {
    invoiceNumber: string;
    invoiceLabel?: string;
    onClose: () => void;
}

function parseSender(sender: string): { name: string; email: string } {
    const match = sender?.match(/^(.+?)\s*<(.+)>$/);
    if (match) return { name: match[1].trim(), email: match[2].trim() };
    return { name: sender || "Unknown", email: sender || "" };
}

export function EmailViewerModal({ invoiceNumber, invoiceLabel, onClose }: EmailViewerModalProps) {
    const [email, setEmail] = useState<EmailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!invoiceNumber) return;
        setEmail(null);
        setError(null);
        setLoading(true);

        const controller = new AbortController();
        fetch(`/api/proxy/evidence/email?invoice_number=${encodeURIComponent(invoiceNumber)}`, {
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.detail || `HTTP ${res.status}`);
                }
                return res.json();
            })
            .then((data) => setEmail(data))
            .catch((err) => {
                if (err.name !== "AbortError") setError(err.message);
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [invoiceNumber]);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                onClick={onClose}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.96, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.96, y: 20, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/50 overflow-hidden"
                >
                    {/* ── Chrome bar ── */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 shrink-0 bg-white/2">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-indigo-500/20 border border-indigo-500/30 rounded-md flex items-center justify-center">
                                <Mail size={12} className="text-indigo-400" />
                            </div>
                            <span className="text-sm font-semibold text-slate-200">Email Evidence</span>
                            <span className="text-xs text-slate-500 font-mono">/ {invoiceLabel || invoiceNumber}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0">

                        {loading && (
                            <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
                                <Loader2 size={18} className="animate-spin text-indigo-400" />
                                <span className="text-sm">Loading email…</span>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-6">
                                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                                    <Mail size={20} className="text-amber-400/60" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-300 mb-1">No Email Found</p>
                                    <p className="text-xs text-slate-500 max-w-xs">
                                        {error.includes("No email")
                                            ? `No source email was found for invoice ${invoiceLabel || invoiceNumber}.`
                                            : error}
                                    </p>
                                </div>
                            </div>
                        )}

                        {email && !loading && (() => {
                            const sender = parseSender(email.sender);
                            const initial = sender.name?.[0]?.toUpperCase() || "?";

                            return (
                                <>
                                    {/* ── Email header (like Gmail's "from" area) ── */}
                                    <div className="px-6 pt-5 pb-4 border-b border-white/8 shrink-0">
                                        {/* Subject */}
                                        <h2 className="text-base font-semibold text-slate-100 leading-snug mb-4">
                                            {email.subject || "(No Subject)"}
                                        </h2>

                                        {/* Sender row */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                                    <span className="text-sm font-bold text-indigo-300">{initial}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200">{sender.name}</p>
                                                    {sender.email !== sender.name && (
                                                        <p className="text-xs text-slate-500 font-mono">{sender.email}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {email.receivedDate && (
                                                <span className="text-xs text-slate-500 shrink-0 mt-1">
                                                    {formatDate(email.receivedDate)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Metadata tags */}
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            {email.invoiceNumber && (
                                                <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 font-mono">
                                                    # {email.invoiceNumber}
                                                </span>
                                            )}
                                            {email.vendorName && (
                                                <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400">
                                                    {email.vendorName}
                                                </span>
                                            )}
                                            <StatusChip status={email.status} />
                                        </div>
                                    </div>

                                    {/* ── Email body ── */}
                                    <div className="flex-1 overflow-y-auto px-6 py-5">
                                        {email.body ? (
                                            <pre className="text-sm text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                                                {email.body}
                                            </pre>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
                                                <Mail size={28} className="opacity-25" />
                                                <p className="text-xs">Email body not available</p>
                                                {email.rawEmailUrl && (
                                                    <a
                                                        href={email.rawEmailUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                                    >
                                                        <ExternalLink size={11} />
                                                        Download raw .eml file
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Attachments bar ── */}
                                    {email.attachments.length > 0 && (
                                        <div className="px-6 py-4 border-t border-white/8 shrink-0 bg-white/2">
                                            <div className="flex items-center gap-1.5 mb-3">
                                                <Paperclip size={11} className="text-slate-500" />
                                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                    {email.attachments.length} Attachment{email.attachments.length !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {email.attachments.map((att, i) => (
                                                    <AttachmentChip key={i} attachment={att} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}


function StatusChip({ status }: { status: string }) {
    const isOk = status === "COMPLETED";
    const isSkipped = status?.startsWith("SKIPPED");
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            isOk
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : isSkipped
                ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                : "bg-slate-500/10 border-slate-500/25 text-slate-400"
        }`}>
            {isOk ? "Processed" : isSkipped ? "Skipped" : status || "Unknown"}
        </span>
    );
}


function AttachmentChip({ attachment: att }: { attachment: EmailAttachment }) {
    const [loading, setLoading] = useState(false);
    const ext = att.name.split(".").pop()?.toUpperCase() || "FILE";

    const handleOpen = () => {
        if (!att.signedUrl) return;
        setLoading(true);
        window.open(att.signedUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => setLoading(false), 1000);
    };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
            att.rejected
                ? "bg-rose-500/5 border-rose-500/15 text-slate-500"
                : "bg-white/4 border-white/10 text-slate-300 hover:bg-white/6"
        }`}>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                att.rejected ? "bg-rose-500/15 text-rose-400/60" : "bg-indigo-500/20 text-indigo-400"
            }`}>
                {ext}
            </span>
            <span className="truncate max-w-[180px] font-mono">{att.name}</span>

            {att.rejected && (
                <span className="flex items-center gap-1 text-rose-400/70 shrink-0">
                    <AlertTriangle size={10} />
                    {att.rejectReason || "rejected"}
                </span>
            )}

            {att.signedUrl && !att.rejected && (
                <button
                    onClick={handleOpen}
                    disabled={loading}
                    className="shrink-0 flex items-center gap-1 ml-0.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
                >
                    {loading ? <Loader2 size={9} className="animate-spin" /> : <ExternalLink size={9} />}
                    Open
                </button>
            )}

            {!att.signedUrl && !att.rejected && (
                <span className="text-slate-600 ml-0.5 text-[10px]">unavailable</span>
            )}
        </div>
    );
}
