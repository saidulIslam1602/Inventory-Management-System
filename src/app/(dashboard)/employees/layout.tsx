import { requireFeatureEnabled } from "@/lib/feature-flags-server";

export default async function EmployeesFeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureEnabled("employees");
  return <>{children}</>;
}
