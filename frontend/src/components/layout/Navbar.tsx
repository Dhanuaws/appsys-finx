"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import {
    Sparkles, MessageSquare, ShieldAlert, Bell,
    Settings, Search, LogOut, Building2, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store";
import { PulseDot } from "@/components/ui/invoice-widgets";
import { Tooltip } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Decode a JWT payload without verification (client-side display only) */
function decodeJwtPayload(token: string): Record<string, unknown> {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(base64));
    } catch {
        return {};
    }
}

const NAV_ITEMS = [
    { href: "/dashboard", icon: MessageSquare, label: "Copilot" },
    { href: "/fraud-station", icon: ShieldAlert, label: "Fraud Station" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function Navbar() {
    const pathname = usePathname();
    const { setCommandOpen } = useUIStore();
    const { data: session } = useSession();
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // Decode Cognito custom attributes from the id token if present
    const idToken = (session as any)?.idToken as string | undefined;
    const jwtPayload = idToken ? decodeJwtPayload(idToken) : {};
    const role = (jwtPayload["custom:role"] as string) ?? "ADMIN";
    const tenantId = (jwtPayload["custom:tenantId"] as string) ?? "tenant-appsys-dev";
    const userName = session?.user?.name ?? "Dev User";
    const userEmail = session?.user?.email ?? "dev@appsys.dev";

    const userInitial = userName.charAt(0).toUpperCase();

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="flex items-center justify-between px-5 h-14 border-b border-finx-border glass-strong shrink-0 z-30">
            {/* Brand */}
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:glow-accent transition-all">
                    <Sparkles size={15} className="text-white" />
                </div>
                <div>
                    <span className="text-sm font-bold text-finx-text tracking-tight">Fin</span>
                    <span className="text-sm font-bold gradient-text tracking-tight">X</span>
                    <span className="text-xs text-finx-text-muted ml-1.5 font-medium hidden sm:inline">
                        Invoice Intelligence
                    </span>
                </div>
            </Link>

            {/* Center Nav */}
            <nav className="flex items-center gap-1 glass rounded-xl p-1">
                {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                    const active = pathname.startsWith(href);
                    return (
                        <Link key={href} href={href}>
                                <div
                                    className={cn(
                                        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                                        active
                                            ? "text-finx-bg"
                                            : "text-finx-text-muted hover:text-finx-text hover:bg-finx-surface-hover"
                                    )}
                                >
                                {active && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute inset-0 gradient-brand rounded-lg opacity-80 shadow-md"
                                    />
                                )}
                                <span className="relative flex items-center gap-1.5">
                                    <Icon size={13} />
                                    <span className="hidden sm:inline">{label}</span>
                                    {label === "Fraud Station" && (
                                        <PulseDot color="bg-rose-400" />
                                    )}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
                {/* Search shortcut */}
                <Tooltip label="⌘K">
                    <button
                        onClick={() => setCommandOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl text-xs text-finx-text-muted hover:text-finx-text transition-colors"
                    >
                        <Search size={13} />
                        <span className="hidden sm:inline">Search</span>
                        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-finx-surface rounded border border-finx-border text-finx-text-muted">
                            ⌘K
                        </kbd>
                    </button>
                </Tooltip>

                {/* Notification Bell */}
                <Tooltip label="Notifications">
                    <button className="relative p-2 glass rounded-xl text-finx-text-muted hover:text-finx-text transition-colors">
                        <Bell size={14} />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-400 rounded-full" />
                    </button>
                </Tooltip>

                {/* Theme toggle */}
                <ThemeToggle />

                {/* Profile dropdown */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setProfileOpen((v) => !v)}
                        className="w-7 h-7 gradient-brand rounded-full flex items-center justify-center text-white text-xs font-bold hover:brightness-110 transition-all active:scale-95 shadow-md shadow-indigo-500/25"
                        title="Profile"
                    >
                        {userInitial}
                    </button>

                    <AnimatePresence>
                        {profileOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                className="absolute right-0 top-9 w-64 rounded-xl border border-finx-border shadow-2xl shadow-black/60 z-50 overflow-hidden"
                                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-border)" }}
                            >
                                {/* User info header */}
                                <div className="px-4 py-3 border-b border-finx-border bg-finx-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 gradient-brand rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                                            {userInitial}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-finx-text truncate">{userName}</p>
                                            <p className="text-xs text-finx-text-muted truncate">{userEmail}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="px-4 py-2.5 space-y-2 border-b border-finx-border">
                                    <div className="flex items-center gap-2.5 text-xs text-finx-text-muted">
                                        <Shield size={12} className="text-finx-accent-1 shrink-0" />
                                        <span className="text-finx-text-dim">Role</span>
                                        <span className="ml-auto font-medium text-finx-text px-1.5 py-0.5 bg-finx-surface rounded border border-finx-border">
                                            {role}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-xs text-finx-text-muted">
                                        <Building2 size={12} className="text-finx-accent-1 shrink-0" />
                                        <span className="text-finx-text-dim">Account</span>
                                        <span className="ml-auto font-mono text-[11px] text-finx-text truncate max-w-[120px]" title={tenantId}>
                                            {tenantId}
                                        </span>
                                    </div>
                                </div>

                                {/* Sign out */}
                                <div className="p-2">
                                    <button
                                        onClick={() => {
                                            // If a real Cognito session exists, use NextAuth signOut
                                            // Otherwise (DEV_MODE / no Cognito) just clear storage and reload
                                            if (idToken) {
                                                signOut({ callbackUrl: "/" });
                                            } else {
                                                sessionStorage.clear();
                                                localStorage.removeItem("finx-chat");
                                                window.location.href = "/";
                                            }
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                                    >
                                        <LogOut size={13} />
                                        Sign out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
