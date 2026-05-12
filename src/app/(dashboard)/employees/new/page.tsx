/**
 * Create employee — ADMIN / MANAGER only. Creates linked User + Employee records.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { CreateEmployeeForm } from "@/components/employees/employee-form";

export const metadata: Metadata = { title: "New Employee" };

export default async function NewEmployeePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/employees");
  }

  const [locations, departments] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (locations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Employee" description="Add staff with login access" />
        <p className="text-muted-foreground text-sm">
          Add at least one location before creating employees.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Employee" description="Creates a user account and employee profile." />
      <CreateEmployeeForm locations={locations} departments={departments} />
    </div>
  );
}
