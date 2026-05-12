"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types";
import { UserMessage } from "@/lib/user-messages";
import { notificationPreferencesInputSchema } from "@/lib/validations/notification-preferences";
import { revalidatePath } from "next/cache";

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
    },
    digestDaily: prefsIn.digestDaily === true,
    emailDigestDaily: prefsIn.emailDigestDaily === true,
  };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPreferences: normalized as object },
  });

  revalidatePath("/me");
  return {
    success: true,
    data: undefined,
    message: "Your notification preferences were saved successfully.",
  };
}
