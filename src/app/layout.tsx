/**
 * Root layout — wraps the entire application.
 * Applies:
 *   - Inter font (Aqila brand typography)
 *   - Geist Mono for code elements
 *   - Global CSS (Aqila brand design tokens)
 *   - SessionProvider for Auth.js client-side access
 */

import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { PortalDomPolyfill } from "@/components/providers/portal-dom-polyfill";
import "./globals.css";

// Inter — the standard choice for professional Norwegian SaaS UIs
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aqila IMS",
    template: "%s | Aqila IMS",
  },
  description:
    "Inventory & Management System for Aqila AS — Lofoten, Norway. Track stock, employees, projects, and purchase orders across all locations.",
  robots: { index: false, follow: false }, // Internal tool, not for search engines
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PortalDomPolyfill />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
