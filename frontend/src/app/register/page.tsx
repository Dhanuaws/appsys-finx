"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sparkles, Loader2, Building, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function RegisterForm() {
    const searchParams = useSearchParams();
    const marketplaceToken = searchParams.get("x-amzn-marketplace-token");

    const [email, setEmail] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_FINX_API_URL || "http://localhost:8000"}/marketplace/onboard`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    marketplace_token: marketplaceToken,
                    email,
                    company_name: companyName,
                    mock_mode: !marketplaceToken // Bypasses AWS ResolveCustomer for local testing
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to provision workspace");
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center p-8 glass rounded-2xl animate-in fade-in zoom-in w-full max-w-md mx-auto text-center border-finx-border-strong border">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-finx-text mb-2">Workspace Created</h2>
                <p className="text-finx-text-muted mb-8 leading-relaxed">
                    We've securely validated your AWS Marketplace subscription and provisioned <strong>{companyName}</strong> onto an isolated FinX core.
                    Check your email (<strong>{email}</strong>) for your temporary Admin password.
                </p>
                <Link
                    href="/api/auth/signin"
                    className="w-full py-3 bg-finx-accent-1 hover:brightness-110 text-white rounded-xl font-medium transition-all shadow-md active:scale-95"
                >
                    Sign In to FinX
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-10">
                <div className="inline-flex w-14 h-14 gradient-brand rounded-2xl items-center justify-center shadow-lg glow-accent mb-6">
                    <Sparkles size={28} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold text-finx-text mb-3">Welcome to FinX</h1>
                <p className="text-finx-text-muted px-4">
                    Complete your AWS Marketplace setup to instantly spin up your isolated enterprise vault.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-8 glass-strong rounded-2xl border border-finx-border shadow-2xl">
                {!marketplaceToken && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400">
                        <strong>Warning:</strong> No AWS Marketplace token found in URL. Registration will run in Mock Mode.
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-finx-text-muted uppercase tracking-wider">Company Name</label>
                    <div className="relative">
                        <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-finx-text-dim" />
                        <input
                            type="text"
                            required
                            placeholder="Acme Corp"
                            className="w-full pl-10 pr-4 py-3 bg-finx-bg border border-finx-border rounded-xl text-sm text-finx-text focus:outline-none focus:border-finx-accent-1"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-finx-text-muted uppercase tracking-wider">Admin Email</label>
                    <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-finx-text-dim" />
                        <input
                            type="email"
                            required
                            placeholder="admin@acmecorp.com"
                            className="w-full pl-10 pr-4 py-3 bg-finx-bg border border-finx-border rounded-xl text-sm text-finx-text focus:outline-none focus:border-finx-accent-1"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <p className="text-[10px] text-finx-text-dim">
                        We will automatically provision your Amazon Cognito administrative account using this address.
                    </p>
                </div>

                {error && (
                    <div className="text-sm font-medium text-rose-400 text-center">{error}</div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 bg-finx-text text-finx-bg hover:bg-finx-text-muted rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Deploy Enterprise Vault"}
                </button>
            </form>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <Suspense fallback={
                <div className="flex items-center gap-2">
                    <Loader2 size={20} className="animate-spin text-finx-accent-1" />
                    <span className="text-finx-text-muted">Loading Amazon Marketplace Token...</span>
                </div>
            }>
                <RegisterForm />
            </Suspense>
        </div>
    );
}
