import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "New Customer" };

export default async function NewCustomerPage() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/customers");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New customer"
        description="Add a master client record for linking from projects."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/customers">Cancel</Link>
          </Button>
        }
      />
      <CustomerForm mode="create" />
    </div>
  );
}
