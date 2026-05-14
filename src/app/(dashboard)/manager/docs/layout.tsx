/**
 * Standalone layout for the Document Portal — full-screen, no sidebar or header.
 * Opens in a new browser tab from the Manager Hub.
 */

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Document Portal — Aqila IMS" };

export default function DocumentPortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-background text-foreground min-h-screen">{children}</div>;
}
