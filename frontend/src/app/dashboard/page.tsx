"use client";

import { useEvidenceStore } from "@/lib/store";
import FilterPane from "@/components/filters/FilterPane";
import ChatPane from "@/components/chat/ChatPane";
import EvidencePanel from "@/components/evidence/EvidencePanel";
import { motion } from "framer-motion";

export default function DashboardPage() {
    const { isOpen: evidenceOpen } = useEvidenceStore();

    return (
        <div className="flex h-full overflow-hidden">
            {/* ── Left: Filter Pane ── */}
            <motion.aside
                initial={false}
                animate={{ width: 256 }}
                className="shrink-0 border-r border-white/6 overflow-hidden h-full"
                style={{ minWidth: 220, maxWidth: 280 }}
            >
                <FilterPane />
            </motion.aside>

            {/* ── Center: Chat Pane ── */}
            <motion.section
                layout
                className="flex-1 min-w-0 h-full"
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
                <ChatPane />
            </motion.section>

            {/* ── Right: Evidence Panel (conditional) ── */}
            <motion.aside
                initial={false}
                animate={{ width: evidenceOpen ? 360 : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="shrink-0 overflow-hidden h-full"
                style={{ minWidth: evidenceOpen ? 280 : 0 }}
            >
                <EvidencePanel />
            </motion.aside>
        </div>
    );
}
