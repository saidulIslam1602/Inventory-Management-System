"use client";

/**
 * Clears navigational HTML caches in the service worker after sign-out so a shared
 * device is less likely to flash another user's cached app shells. No-op if no SW.
 */
export function clearAuthPageCaches(): void {
  if (typeof navigator === "undefined") return;
  const ctrl = navigator.serviceWorker?.controller;
  if (!ctrl) return;
  try {
    ctrl.postMessage({ type: "CLEAR_AUTH_PAGE_CACHES" });
  } catch {
    /* ignore */
  }
}
