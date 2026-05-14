"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  pushStaffCmdRecent,
  staffCmdPaletteHref,
  staffCmdRouteLabel,
} from "@/lib/staff-cmd-palette-storage";

/**
 * Records STAFF dashboard navigations into the Cmd+K recent list (per-user localStorage).
 */
export function StaffCmdPaletteRouteRecorder({ userId }: { userId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastHref = React.useRef<string | null>(null);

  React.useEffect(() => {
    const href = staffCmdPaletteHref(pathname, searchParams);
    if (lastHref.current === href) return;
    lastHref.current = href;
    const { title, subtitle } = staffCmdRouteLabel(pathname, searchParams);
    queueMicrotask(() => {
      pushStaffCmdRecent(userId, { href, title, subtitle });
    });
  }, [pathname, searchParams, userId]);

  return null;
}
