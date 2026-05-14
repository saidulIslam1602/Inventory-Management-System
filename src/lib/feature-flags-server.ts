import { redirect } from "next/navigation";
import { getCachedAppSettings } from "@/lib/app-settings-cache";
import {
  mergeFeatureFlags,
  type FeatureFlagKey,
  type ResolvedFeatureFlags,
} from "@/lib/feature-flags";

export async function getResolvedFeatureFlags(): Promise<ResolvedFeatureFlags> {
  const row = await getCachedAppSettings();
  return mergeFeatureFlags(row?.featureFlags ?? null);
}

/** Redirect to dashboard when a module is turned off (server layouts). */
export async function requireFeatureEnabled(flag: FeatureFlagKey): Promise<void> {
  const flags = await getResolvedFeatureFlags();
  if (!flags[flag]) {
    redirect("/dashboard");
  }
}
