"use client";

import { create } from "zustand";
import type {
    ChatMessage,
    InvoiceFilters,
    Invoice,
    EmailEvidence,
    FraudCase,
    UserSession,
} from "@/lib/types";
import { nanoid } from "@/lib/utils";

// ── Chat Store ────────────────────────────────────────────────
interface ChatStore {
    messages: ChatMessage[];
    isStreaming: boolean;
    addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => string;
    updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
    clearChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
    messages: [],
    isStreaming: false,

    addMessage: (msg) => {
        const id = nanoid();
        set((s) => ({
            messages: [...s.messages, { ...msg, id, timestamp: new Date() }],
            isStreaming: msg.isStreaming ?? false,
        }));
        return id;
    },

    updateMessage: (id, patch) =>
        set((s) => ({
            messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
            isStreaming: patch.isStreaming !== undefined ? patch.isStreaming : s.isStreaming,
        })),

    clearChat: () => set({ messages: [], isStreaming: false }),
}));

// ── Filter Store ──────────────────────────────────────────────
interface FilterStore {
    filters: InvoiceFilters;
    datePreset: string;
    setFilter: <K extends keyof InvoiceFilters>(key: K, value: InvoiceFilters[K]) => void;
    setDatePreset: (preset: string, from: string, to: string) => void;
    resetFilters: () => void;
}

const defaultFilters: InvoiceFilters = {};

export const useFilterStore = create<FilterStore>((set) => ({
    filters: defaultFilters,
    datePreset: "30d",

    setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),

    setDatePreset: (preset, from, to) =>
        set((s) => ({
            datePreset: preset,
            filters: { ...s.filters, dateFrom: from, dateTo: to },
        })),

    resetFilters: () => set({ filters: defaultFilters, datePreset: "30d" }),
}));

// ── Evidence Panel Store ──────────────────────────────────────
interface EvidenceStore {
    selectedInvoice: Invoice | null;
    emailEvidence: EmailEvidence | null;
    isOpen: boolean;
    isLoading: boolean;
    openEvidence: (invoice: Invoice) => void;
    setEmailEvidence: (ev: EmailEvidence | null) => void;
    setLoading: (v: boolean) => void;
    close: () => void;
}

export const useEvidenceStore = create<EvidenceStore>((set) => ({
    selectedInvoice: null,
    emailEvidence: null,
    isOpen: false,
    isLoading: false,

    openEvidence: (invoice) =>
        set({ selectedInvoice: invoice, isOpen: true, emailEvidence: null, isLoading: true }),

    setEmailEvidence: (ev) => set({ emailEvidence: ev, isLoading: false }),

    setLoading: (v) => set({ isLoading: v }),

    close: () =>
        set({ isOpen: false, selectedInvoice: null, emailEvidence: null }),
}));

// ── Fraud Case Store ──────────────────────────────────────────
interface FraudStore {
    cases: FraudCase[];
    selectedCase: FraudCase | null;
    setCases: (cases: FraudCase[]) => void;
    selectCase: (c: FraudCase | null) => void;
}

export const useFraudStore = create<FraudStore>((set) => ({
    cases: [],
    selectedCase: null,
    setCases: (cases) => set({ cases }),
    selectCase: (c) => set({ selectedCase: c }),
}));

// ── Session Store ─────────────────────────────────────────────
interface SessionStore {
    session: UserSession | null;
    setSession: (s: UserSession | null) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
    session: null,
    setSession: (s) => set({ session: s }),
}));

// ── UI Store ──────────────────────────────────────────────────
interface UIStore {
    commandOpen: boolean;
    sidebarCollapsed: boolean;
    theme: "dark" | "light";
    setCommandOpen: (v: boolean) => void;
    toggleSidebar: () => void;
    setTheme: (t: "dark" | "light") => void;
}

export const useUIStore = create<UIStore>((set) => ({
    commandOpen: false,
    sidebarCollapsed: false,
    theme: "dark",
    setCommandOpen: (v) => set({ commandOpen: v }),
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    setTheme: (t) => set({ theme: t }),
}));
