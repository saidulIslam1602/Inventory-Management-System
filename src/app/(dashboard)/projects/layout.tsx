import { requireFeatureEnabled } from "@/lib/feature-flags-server";

export default async function ProjectsFeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureEnabled("projects");
  return <>{children}</>;
}
