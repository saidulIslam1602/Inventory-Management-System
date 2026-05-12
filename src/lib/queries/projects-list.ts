import { ProjectStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const PROJECT_STATUSES = Object.values(ProjectStatus);

export function buildProjectWhere(params: {
  status?: ProjectStatus;
  locationId?: string;
  q?: string;
  /** Limit to projects that assign this employee (e.g. STAFF portal). */
  assignedToEmployeeId?: string;
}): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.locationId) where.locationId = params.locationId;
  if (params.assignedToEmployeeId) {
    where.employees = { some: { employeeId: params.assignedToEmployeeId } };
  }
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { projectCode: { contains: params.q, mode: "insensitive" } },
      { clientName: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }
  return where;
}
