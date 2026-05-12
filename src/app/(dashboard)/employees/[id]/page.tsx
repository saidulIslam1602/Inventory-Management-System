/**
 * Edit employee — ADMIN / MANAGER. Updates User + Employee profile fields.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { EditEmployeeForm } from "@/components/employees/employee-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const emp = await prisma.employee.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, employeeCode: true },
  });
  if (!emp) return { title: "Employee" };
  return { title: `${emp.firstName} ${emp.lastName}` };
}

export default async function EditEmployeePage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/employees");
  }

  const { id } = await params;

  const [employee, locations, departments] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { email: true, role: true } } },
    }),
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

  if (!employee) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${employee.firstName} ${employee.lastName}`}
        description={`${employee.employeeCode} · ${employee.user.email}`}
      />
      <EditEmployeeForm
        employeeId={employee.id}
        locations={locations}
        departments={departments}
        defaultValues={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.user.email,
          role: employee.user.role,
          employeeCode: employee.employeeCode,
          hireDate: employee.hireDate,
          locationId: employee.locationId,
          departmentId: employee.departmentId,
          phone: employee.phone,
          address: employee.address,
          photoUrl: employee.photoUrl,
          isActive: employee.isActive,
        }}
      />
    </div>
  );
}
