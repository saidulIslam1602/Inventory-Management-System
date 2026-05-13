import { requireFeatureEnabled } from "@/lib/feature-flags-server";

export default async function ReportsFeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureEnabled("reports");
  return <>{children}</>;
}
