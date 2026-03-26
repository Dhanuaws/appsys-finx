"use client";

import { useState } from "react";
import { UserPlus, Shield, Check, Loader2, Mail, Users, Key } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("AP_CLERK");
    const [permissions, setPermissions] = useState({
        canViewEmails: false,
        piiAccess: false,
        canApprovePayments: false
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);

        try {
            // Because we're using HttpOnly cookies natively, we route this to our new proxy
            const res = await fetch("/api/proxy/users/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    role,
                    can_view_emails: permissions.canViewEmails,
                    pii_access: permissions.piiAccess,
                    can_approve_payments: permissions.canApprovePayments,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.error || "Failed to invite user");

            setSuccess(true);
            setEmail("");
            setPermissions({ canViewEmails: false, piiAccess: false, canApprovePayments: false });
            
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (key: keyof typeof permissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex flex-col h-full bg-finx-bg p-6 lg:p-10 overflow-y-auto w-full">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-finx-text tracking-tight mb-2">Workspace Settings</h1>
                <p className="text-sm text-finx-text-muted max-w-xl leading-relaxed">
                    Manage your isolated FinX tenant. Invite new analysts to collaborate on invoice audits
                    and configure exactly what evidence they are cleared to access.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
                {/* Team Management Card */}
                <div className="lg:col-span-2 glass-strong border border-finx-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-finx-border pb-4">
                        <div className="w-10 h-10 gradient-brand rounded-lg flex items-center justify-center text-white shadow-md glow-accent">
                            <Users size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-finx-text">Team Provisioning</h2>
                            <p className="text-xs text-finx-text-muted">Invite users to your secure tenant boundary</p>
                        </div>
                    </div>

                    <form onSubmit={handleInvite} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-finx-text-muted uppercase tracking-wider">Email Address</label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-finx-text-dim" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="analyst@yourcompany.com"
                                        className="w-full pl-9 pr-3 py-2 bg-finx-surface border border-finx-border rounded-lg text-sm text-finx-text focus:outline-none focus:border-finx-accent-1 transition-colors"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-finx-text-muted uppercase tracking-wider">Access Level</label>
                                <select 
                                    className="w-full px-3 py-2 bg-finx-surface border border-finx-border rounded-lg text-sm text-finx-text focus:outline-none focus:border-finx-accent-1 transition-colors"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="AP_CLERK">Accounts Payable Clerk</option>
                                    <option value="FINANCE_MANAGER">Finance Manager</option>
                                    <option value="ADMIN">Tenant Administrator</option>
                                </select>
                            </div>
                        </div>

                        {/* RBAC Toggles */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-finx-text-muted uppercase tracking-wider">Fine-Grained Permissions</label>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { id: "canViewEmails", label: "Email Evidence", desc: "View raw supplier emails", icon: Mail },
                                    { id: "piiAccess", label: "PII Access", desc: "View bank routing info", icon: Shield },
                                    { id: "canApprovePayments", label: "Approvals", desc: "Push to ERP", icon: Key }
                                ].map((perm) => (
                                    <button
                                        key={perm.id}
                                        type="button"
                                        onClick={() => togglePermission(perm.id as keyof typeof permissions)}
                                        className={cn(
                                            "flex flex-col gap-1.5 p-3 rounded-lg border text-left transition-all",
                                            permissions[perm.id as keyof typeof permissions] 
                                                ? "bg-finx-accent-glow border-finx-accent-1 text-finx-accent-1"
                                                : "glass border-finx-border text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover hover:border-finx-border-strong cursor-pointer"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <perm.icon size={15} />
                                            {permissions[perm.id as keyof typeof permissions] && (
                                                <Check size={14} className="text-finx-accent-1" />
                                            )}
                                        </div>
                                        <div>
                                            <div className={cn("text-xs font-medium", permissions[perm.id as keyof typeof permissions] ? "text-finx-accent-1" : "text-finx-text")}>{perm.label}</div>
                                            <div className="text-[10px] opacity-70 mt-0.5">{perm.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm font-medium text-rose-400">{error}</div>}
                        {success && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm font-medium text-emerald-400 flex items-center gap-2"><Check size={16}/> Invitation sent successfully to {email}!</div>}

                        <div className="pt-2 border-t border-finx-border flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="flex items-center gap-2 px-5 py-2.5 bg-finx-text text-finx-bg hover:bg-finx-text-muted rounded-lg text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                Send Invite
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Side Info Panel */}
                <div className="flex flex-col gap-4">
                    <div className="glass-strong border border-finx-border rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-finx-text-muted" />
                            <h3 className="text-sm font-semibold text-finx-text">Security Architecture</h3>
                        </div>
                        <p className="text-xs text-finx-text-muted leading-relaxed">
                            Every user invited through this portal is cryptographically bound to your organization's 
                            unique Tenant ID. FinX's multi-tenant gateway guarantees strict data segregation at the API level.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
