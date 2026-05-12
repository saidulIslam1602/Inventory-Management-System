"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserMessage } from "@/lib/user-messages";
import { exceptionThresholdSettingsSchema } from "@/lib/validations/app-settings";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";

const DEFAULT_ID = "default";

export async function updateExceptionThresholdSettings(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = exceptionThresholdSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const stale = parsed.data.exceptionStaleSubmitDays;
  const overdue = parsed.data.exceptionOverdueReceiveDays;
  const minBranches = parsed.data.exceptionMinLowStockBranches;

  await prisma.appSettings.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
      exceptionStaleSubmitDays: stale,
      exceptionOverdueReceiveDays: overdue,
      exceptionMinLowStockBranches: minBranches,
    },
    update: {
      exceptionStaleSubmitDays: stale,
      exceptionOverdueReceiveDays: overdue,
      exceptionMinLowStockBranches: minBranches,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/manager");
  return {
    success: true,
    data: undefined,
    message: "Exception thresholds were updated successfully.",
  };
}
