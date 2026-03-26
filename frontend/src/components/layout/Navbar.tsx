"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
    Sparkles, MessageSquare, ShieldAlert, Bell,
    Settings, Command, Search, Sun, Moon, LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store";
import { PulseDot } from "@/components/ui/invoice-widgets";
import { Tooltip } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
    { href: "/dashboard", icon: MessageSquare, label: "Copilot" },
    { href: "/fraud-station", icon: ShieldAlert, label: "Fraud Station" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function Navbar() {
    const pathname = usePathname();
    const { setCommandOpen } = useUIStore();

    return (
        <header className="flex items-center justify-between px-5 h-14 border-b border-white/6 glass-strong shrink-0 z-30">
            {/* Brand */}
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:glow-accent transition-all">
                    <Sparkles size={15} className="text-white" />
                </div>
                <div>
                    <span className="text-sm font-bold text-white tracking-tight">Fin</span>
                    <span className="text-sm font-bold gradient-text tracking-tight">X</span>
                    <span className="text-xs text-slate-600 ml-1.5 font-medium hidden sm:inline">
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
                                        ? "text-white"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
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
                        className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <Search size={13} />
                        <span className="hidden sm:inline">Search</span>
                        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-white/6 rounded border border-white/10">
                            ⌘K
                        </kbd>
                    </button>
                </Tooltip>

                {/* Notification Bell */}
                <Tooltip label="Notifications">
                    <button className="relative p-2 glass rounded-xl text-slate-400 hover:text-slate-200 transition-colors">
                        <Bell size={14} />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-400 rounded-full" />
                    </button>
                </Tooltip>

                {/* Theme toggle */}
                <ThemeToggle />

                {/* User avatar */}
                <div className="w-7 h-7 gradient-brand rounded-full flex items-center justify-center text-white text-xs font-bold">
                    A
                </div>
            </div>
        </header>
    );
}
