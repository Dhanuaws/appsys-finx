import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: "FinX — Invoice Intelligence Copilot",
    description:
        "AI-powered invoice intelligence platform. Search, detect fraud, and audit invoices with evidence-first AI powered by Amazon Nova.",
    keywords: ["invoice", "AI", "fraud detection", "accounts payable", "fintech", "amazon nova"],
    openGraph: {
        title: "FinX Invoice Intelligence",
        description: "Evidence-first AI for accounts payable teams",
        type: "website",
    },
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                <meta name="theme-color" content="#060a12" />
            </head>
            <body className="bg-mesh antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
