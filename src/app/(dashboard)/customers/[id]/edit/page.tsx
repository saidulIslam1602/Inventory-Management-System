import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/components/customers/customer-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: c ? `Edit ${c.name}` : "Edit customer" };
}

export default async function EditCustomerPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/customers");
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      notes: true,
      isActive: true,
    },
  });

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${customer.name}`}
        description="Update contact details and active status."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/customers/${customer.id}`}>Back</Link>
          </Button>
        }
      />
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        initial={{
          name: customer.name,
          email: customer.email ?? undefined,
          phone: customer.phone ?? undefined,
          address: customer.address ?? undefined,
          notes: customer.notes ?? undefined,
          isActive: customer.isActive,
        }}
      />
    </div>
  );
}
