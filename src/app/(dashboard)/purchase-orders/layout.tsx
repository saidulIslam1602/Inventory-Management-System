import { requireFeatureEnabled } from "@/lib/feature-flags-server";

export default async function PurchaseOrdersFeatureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireFeatureEnabled("purchaseOrders");
  return <>{children}</>;
}
