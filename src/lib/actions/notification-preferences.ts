"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types";
import { UserMessage } from "@/lib/user-messages";
import { notificationPreferencesInputSchema } from "@/lib/validations/notification-preferences";
import { revalidatePath } from "next/cache";
import { auditDataChange } from "@/lib/audit/record-event";

export async function updateMyNotificationPreferences(prefs: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: UserMessage.auth.signInRequired };

  const parsed = notificationPreferencesInputSchema.safeParse(prefs);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const prefsIn = parsed.data;

  try {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPreferences: true },
    });
    const raw = existing?.notificationPreferences;
    const base =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? { ...(raw as Record<string, unknown>) }
        : {};

    const instant = prefsIn.instant ?? {};
    const normalized = {
      ...base,
      instant: {
        poSubmitted: instant.poSubmitted !== false,
        poApproved: instant.poApproved !== false,
        poOrdered: instant.poOrdered !== false,
        poReceived: instant.poReceived !== false,
        poApprovalEscalation: instant.poApprovalEscalation !== false,
      },
      digestDaily: prefsIn.digestDaily === true,
      emailDigestDaily: prefsIn.emailDigestDaily === true,
      emailApprovalEscalation: prefsIn.emailApprovalEscalation === true,
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationPreferences: normalized as object },
    });

    await auditDataChange({
      session,
      action: "user.notification_preferences.update",
      summary: "Updated notification delivery preferences.",
      targetType: "User",
      targetId: session.user.id,
      metadata: {
        digestDaily: normalized.digestDaily,
        emailDigestDaily: normalized.emailDigestDaily,
        emailApprovalEscalation: normalized.emailApprovalEscalation,
        instant: normalized.instant,
      },
    });

    revalidatePath("/me");
    return {
      success: true,
      data: undefined,
      message: "Your notification preferences were saved successfully.",
    };
  } catch {
    return { success: false, error: "Could not save preferences. Please try again." };
  }
}
