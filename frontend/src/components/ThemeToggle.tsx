"use client";

import { useState } from "react";
import { Palette, Moon, Sun, Check, Monitor, LayoutTemplate } from "lucide-react";
import { useTheme } from "@/app/Providers";

const themes = [
    { id: "neo", name: "Neo Dark", icon: Moon, description: "Glossy UI tech dark mode" },
    { id: "light", name: "Elegant Light", icon: Sun, description: "Crisp white minimalism" },
    { id: "midnight", name: "Nordic Midnight", icon: Monitor, description: "Soft deep slate grays" },
    { id: "classic", name: "Corporate Monochrome", icon: LayoutTemplate, description: "High contrast B&W" }
] as const;

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 ml-2 mr-2 rounded-full glass hover:bg-white/10 transition-colors text-slate-300 dark:text-slate-300"
                title="Change Theme"
            >
                <Palette size={18} />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-12 mt-2 w-64 glass-strong border border-white/10 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-3xl animate-in slide-in-from-top-2">
                        <div className="px-2 py-1 mb-2 border-b border-white/5">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Theme</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            {themes.map((t) => {
                                const Icon = t.icon;
                                const isActive = theme === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            setTheme(t.id as any);
                                            setIsOpen(false);
                                        }}
                                        className={`flex items-center gap-3 w-full p-2 text-left rounded-lg transition-colors group ${
                                            isActive ? "bg-indigo-500/20 text-indigo-400" : "hover:bg-white/5 text-slate-300"
                                        }`}
                                    >
                                        <div className={`p-1.5 rounded-md ${isActive ? "bg-indigo-500/20" : "bg-white/5 group-hover:bg-white/10"}`}>
                                            <Icon size={14} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{t.name}</div>
                                            <div className="text-[10px] text-slate-500">{t.description}</div>
                                        </div>
                                        {isActive && <Check size={14} className="text-indigo-400" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
