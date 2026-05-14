import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessManagerHub } from "@/lib/rbac";
import { DocumentPortalClient } from "@/components/manager/document-portal-client";

export default async function DocumentPortalPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessManagerHub(session.user.role)) redirect("/dashboard");

  return <DocumentPortalClient userName={session.user.name ?? session.user.email ?? "Manager"} />;
}
