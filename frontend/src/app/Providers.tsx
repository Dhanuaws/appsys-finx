"use client";

import { SessionProvider } from "next-auth/react";
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "neo" | "light" | "midnight" | "classic";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used within ThemeProvider");
    return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("neo");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("finx-theme") as Theme | null;
        if (stored) {
            setThemeState(stored);
            document.documentElement.setAttribute("data-theme", stored);
        } else {
            document.documentElement.setAttribute("data-theme", "neo");
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem("finx-theme", newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <SessionProvider>
                <div style={{ visibility: mounted ? "visible" : "hidden" }}>
                    {children}
                </div>
            </SessionProvider>
        </ThemeContext.Provider>
    );
}
