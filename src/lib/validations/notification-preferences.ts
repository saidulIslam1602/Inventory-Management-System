import { z } from "zod";

const instantPoSchema = z
  .object({
    poSubmitted: z.boolean().optional(),
    poApproved: z.boolean().optional(),
    poOrdered: z.boolean().optional(),
    poReceived: z.boolean().optional(),
  })
  .strict();

/**
 * Body for `updateMyNotificationPreferences`. Unknown keys rejected.
 * `_lastDigestEmailAt` is server-managed only — not accepted from clients.
 */
export const notificationPreferencesInputSchema = z
  .object({
    instant: instantPoSchema.optional(),
    digestDaily: z.boolean().optional(),
    emailDigestDaily: z.boolean().optional(),
  })
  .strict();

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesInputSchema>;
