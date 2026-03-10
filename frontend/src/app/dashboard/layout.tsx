import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
    title: "Dashboard — FinX Invoice Intelligence",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-hidden">
                {children}
            </main>
        </div>
    );
}
