"use server";

import { AuditEventCategory } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractAuditMetaFromNextHeaders, recordAuditEventSafe } from "@/lib/audit/record-event";
import { UserMessage } from "@/lib/user-messages";
import {
  exceptionThresholdSettingsSchema,
  featureFlagsSettingsSchema,
  maintenanceBannerSettingsSchema,
} from "@/lib/validations/app-settings";
import type { Prisma } from "@prisma/client";
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

  try {
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

    const auditMeta = await extractAuditMetaFromNextHeaders();
    await recordAuditEventSafe({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      category: AuditEventCategory.SETTINGS,
      action: "settings.exception_thresholds.update",
      targetType: "AppSettings",
      targetId: DEFAULT_ID,
      summary: `Exception thresholds updated (stale ${stale}d, overdue ${overdue}d, min branches ${minBranches}).`,
      metadata: parsed.data,
      ...auditMeta,
    });

    revalidatePath("/settings");
    revalidatePath("/manager");
    revalidatePath("/settings/audit-log");
    return {
      success: true,
      data: undefined,
      message: "Exception thresholds were updated successfully.",
    };
  } catch {
    return { success: false, error: "Could not save settings. Please try again." };
  }
}

export async function updateFeatureFlags(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = featureFlagsSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const json = parsed.data as unknown as Prisma.InputJsonValue;

  try {
    await prisma.appSettings.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        exceptionStaleSubmitDays: 2,
        exceptionOverdueReceiveDays: 7,
        exceptionMinLowStockBranches: 2,
        featureFlags: json,
      },
      update: {
        featureFlags: json,
      },
    });

    const auditMeta = await extractAuditMetaFromNextHeaders();
    await recordAuditEventSafe({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      category: AuditEventCategory.SETTINGS,
      action: "settings.feature_flags.update",
      targetType: "AppSettings",
      targetId: DEFAULT_ID,
      summary: "Feature flags updated.",
      metadata: parsed.data,
      ...auditMeta,
    });

    const paths = [
      "/settings",
      "/dashboard",
      "/manager",
      "/purchase-orders",
      "/employees",
      "/projects",
      "/customers",
      "/reports",
    ] as const;
    for (const p of paths) {
      revalidatePath(p);
    }
    revalidatePath("/settings/audit-log");

    return {
      success: true,
      data: undefined,
      message: "Feature flags were updated.",
    };
  } catch {
    return { success: false, error: "Could not save settings. Please try again." };
  }
}

function parseOptionalBannerDate(raw: string | undefined): Date | null {
  if (raw == null || !raw.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function updateMaintenanceBannerSettings(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = maintenanceBannerSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const message = parsed.data.maintenanceBannerMessage.trim();
  if (parsed.data.maintenanceBannerEnabled && !message) {
    return {
      success: false,
      error: "Enter a short message when the banner is enabled.",
    };
  }

  const startsAt = parseOptionalBannerDate(parsed.data.maintenanceBannerStartsAt);
  const endsAt = parseOptionalBannerDate(parsed.data.maintenanceBannerEndsAt);
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { success: false, error: "End time must be after start time." };
  }

  try {
    await prisma.appSettings.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        exceptionStaleSubmitDays: 2,
        exceptionOverdueReceiveDays: 7,
        exceptionMinLowStockBranches: 2,
        maintenanceBannerEnabled: parsed.data.maintenanceBannerEnabled,
        maintenanceBannerMessage: message,
        maintenanceBannerStartsAt: startsAt,
        maintenanceBannerEndsAt: endsAt,
      },
      update: {
        maintenanceBannerEnabled: parsed.data.maintenanceBannerEnabled,
        maintenanceBannerMessage: message,
        maintenanceBannerStartsAt: startsAt,
        maintenanceBannerEndsAt: endsAt,
      },
    });

    const auditMeta = await extractAuditMetaFromNextHeaders();
    await recordAuditEventSafe({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      category: AuditEventCategory.SETTINGS,
      action: "settings.maintenance_banner.update",
      targetType: "AppSettings",
      targetId: DEFAULT_ID,
      summary: parsed.data.maintenanceBannerEnabled
        ? `Maintenance banner enabled (${message.slice(0, 120)}${message.length > 120 ? "…" : ""})`
        : "Maintenance banner disabled.",
      metadata: {
        enabled: parsed.data.maintenanceBannerEnabled,
        startsAt: startsAt?.toISOString() ?? null,
        endsAt: endsAt?.toISOString() ?? null,
        messageLength: message.length,
      },
      ...auditMeta,
    });

    const paths = [
      "/settings",
      "/dashboard",
      "/login",
      "/forgot-password",
      "/reset-password",
      "/change-password",
    ] as const;
    for (const p of paths) {
      revalidatePath(p);
    }
    revalidatePath("/dashboard", "layout");
    revalidatePath("/settings/audit-log");

    return {
      success: true,
      data: undefined,
      message: "Maintenance banner was updated.",
    };
  } catch {
    return { success: false, error: "Could not save settings. Please try again." };
  }
}
