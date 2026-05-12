"use client";

import * as React from "react";

/**
 * Registers a minimal service worker in production only (navigate offline fallback).
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore: invalid scope or dev proxy */
    });
  }, []);

  return null;
}
