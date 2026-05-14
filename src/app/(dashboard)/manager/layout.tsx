import { requireFeatureEnabled } from "@/lib/feature-flags-server";

export default async function ManagerFeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureEnabled("managerHub");
  return <>{children}</>;
}
