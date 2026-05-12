"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserMessage } from "@/lib/user-messages";
import { notificationIdSchema } from "@/lib/validations/notifications";
import type { ActionResult } from "@/types";

export async function markNotificationRead(notificationId: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: UserMessage.auth.signInRequired };

  const idParsed = notificationIdSchema.safeParse(notificationId);
  if (!idParsed.success) {
    return {
      success: false,
      error: idParsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }
  const id = idParsed.data;

  const row = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!row) return { success: false, error: "That notification could not be found." };

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  revalidatePath("/me");
  revalidatePath("/dashboard");
  revalidatePath("/manager");
  return { success: true, data: undefined };
}

export async function markAllMyNotificationsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: UserMessage.auth.signInRequired };

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/me");
  revalidatePath("/dashboard");
  revalidatePath("/manager");
  return { success: true, data: undefined };
}
