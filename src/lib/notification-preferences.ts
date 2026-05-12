/**
 * User-controlled notification delivery (instant PO lifecycle vs daily digest).
 */

import type { Prisma } from "@prisma/client";

export type InstantPoPreferenceKey = "poSubmitted" | "poApproved" | "poOrdered" | "poReceived";

export type NotificationPreferencesV1 = {
  instant?: Partial<Record<InstantPoPreferenceKey, boolean>>;
  digestDaily?: boolean;
  /** When true and SMTP is configured, daily digest is emailed (scheduled job). */
  emailDigestDaily?: boolean;
  /**
   * Server-managed ISO timestamp; do not send from the client.
   * Throttles duplicate digest emails per user.
   */
  _lastDigestEmailAt?: string;
};

export function parseNotificationPreferences(
  raw: Prisma.JsonValue | null | undefined
): NotificationPreferencesV1 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as NotificationPreferencesV1;
}

/** Default: instant PO alerts are on unless explicitly disabled. */
export function wantsInstantPoEvent(
  raw: Prisma.JsonValue | null | undefined,
  key: InstantPoPreferenceKey
): boolean {
  const v = parseNotificationPreferences(raw).instant?.[key];
  return v !== false;
}

export function wantsDigestDaily(raw: Prisma.JsonValue | null | undefined): boolean {
  return parseNotificationPreferences(raw).digestDaily === true;
}

export function wantsEmailDigestDaily(raw: Prisma.JsonValue | null | undefined): boolean {
  return parseNotificationPreferences(raw).emailDigestDaily === true;
}
