import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "New Project" };

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/projects");
  }

  const [locations, customers] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (locations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Project" description="A location is required to create a project." />
        <Button asChild variant="outline">
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New project"
        description="Create a work order / installation job."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">Cancel</Link>
          </Button>
        }
      />
      <ProjectForm locations={locations} customers={customers} />
    </div>
  );
}
