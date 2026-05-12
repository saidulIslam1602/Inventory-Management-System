import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const USER_ROLES = Object.values(UserRole);
export const EMPLOYEE_NO_DEPT = "__none__";

export function buildEmployeeWhere(params: {
  departmentId?: string;
  role?: UserRole;
  employment?: "active" | "inactive";
  q?: string;
}): Prisma.EmployeeWhereInput {
  const and: Prisma.EmployeeWhereInput[] = [];

  if (params.departmentId === EMPLOYEE_NO_DEPT) and.push({ departmentId: null });
  else if (params.departmentId) and.push({ departmentId: params.departmentId });

  if (params.employment === "active") and.push({ isActive: true });
  if (params.employment === "inactive") and.push({ isActive: false });

  if (params.role) and.push({ user: { role: params.role } });

  if (params.q) {
    and.push({
      OR: [
        { firstName: { contains: params.q, mode: "insensitive" } },
        { lastName: { contains: params.q, mode: "insensitive" } },
        { employeeCode: { contains: params.q, mode: "insensitive" } },
        { user: { email: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }

  if (and.length === 0) return {};
  return { AND: and };
}
