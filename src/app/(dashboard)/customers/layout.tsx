import { requireFeatureEnabled } from "@/lib/feature-flags-server";

export default async function CustomersFeatureLayout({ children }: { children: React.ReactNode }) {
  await requireFeatureEnabled("customers");
  return <>{children}</>;
}
