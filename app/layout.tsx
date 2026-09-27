import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Augurio — AI Agent", description: "Agente de IA adaptativo e resiliente" };

export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="pt-BR"><body>{children}</body></html>; }