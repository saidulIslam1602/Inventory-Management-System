"use client";

import { useEffect } from "react";

/**
 * Patches `Node.prototype.removeChild` so that React's concurrent reconciler
 * does not throw a `NotFoundError` when it tries to remove a Base UI / Floating UI
 * portal container from `document.body` that was already removed by a concurrent
 * render in the same navigation commit.
 *
 * Root cause: Base UI's `FloatingPortal` creates a two-level portal:
 *   1. `createPortal(<div/>, body)` — injects an intermediate container div into body
 *   2. `createPortal(children, div)` — injects floating content into that container
 *
 * React's concurrent reconciler can process these two portal fibers in an order
 * that causes the intermediate div to be removed from body before React finishes
 * removing its children, leaving a detached node reference. The second `removeChild`
 * then throws "not a child of this node".
 *
 * This polyfill detects portal nodes (marked `data-portal` by Base UI) and silently
 * no-ops the duplicate removal instead of throwing — the DOM is already in the
 * correct state since the first removal succeeded.
 */
export function PortalDomPolyfill() {
  useEffect(() => {
    const original = Node.prototype.removeChild as <T extends Node>(child: T) => T;

    // @ts-expect-error — intentional monkey-patch for portal cleanup safety
    Node.prototype.removeChild = function safeRemoveChild<T extends Node>(this: Node, child: T): T {
      if (!this.contains(child)) {
        // Only swallow for Base UI / floating-ui portal container nodes.
        // Real app bugs (removing wrong nodes) are still surfaced for non-portal elements.
        const isPortalNode = child instanceof Element && child.hasAttribute("data-base-ui-portal");

        if (isPortalNode) {
          return child; // already removed — no-op
        }
      }
      return original.call(this, child) as T;
    };

    return () => {
      Node.prototype.removeChild = original;
    };
  }, []);

  return null;
}
