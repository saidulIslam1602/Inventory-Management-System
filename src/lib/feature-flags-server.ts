import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  mergeFeatureFlags,
  type FeatureFlagKey,
  type ResolvedFeatureFlags,
} from "@/lib/feature-flags";

export async function getResolvedFeatureFlags(): Promise<ResolvedFeatureFlags> {
  const row = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { featureFlags: true },
  });
  return mergeFeatureFlags(row?.featureFlags ?? null);
}

/** Redirect to dashboard when a module is turned off (server layouts). */
export async function requireFeatureEnabled(flag: FeatureFlagKey): Promise<void> {
  const flags = await getResolvedFeatureFlags();
  if (!flags[flag]) {
    redirect("/dashboard");
  }
}
