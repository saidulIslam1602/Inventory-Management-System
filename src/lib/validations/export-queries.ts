import { AttendanceStatus, MovementType, POStatus, ProjectStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { EMPLOYEE_NO_DEPT } from "@/lib/queries/employees-list";
import {
  emptyToUndefined,
  optionalBoundedQuery,
  optionalCuidParam,
  optionalIsoDateParam,
} from "@/lib/validations/common";

const optionalDepartmentFilter = z.preprocess(
  emptyToUndefined,
  z
    .union([z.literal(EMPLOYEE_NO_DEPT), z.string().cuid("Invalid department identifier.")])
    .optional()
);

export const stockMovementsExportQuerySchema = z.object({
  type: z.nativeEnum(MovementType).optional(),
  location: optionalCuidParam,
  product: optionalCuidParam,
  q: optionalBoundedQuery,
  from: optionalIsoDateParam,
  to: optionalIsoDateParam,
});

export const projectsExportQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  location: optionalCuidParam,
  q: optionalBoundedQuery,
});

export const employeesExportQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  employment: z.enum(["active", "inactive"]).optional(),
  department: optionalDepartmentFilter,
  q: optionalBoundedQuery,
});

export const purchaseOrdersExportQuerySchema = z.object({
  status: z.nativeEnum(POStatus).optional(),
  supplier: optionalCuidParam,
  location: optionalCuidParam,
  q: optionalBoundedQuery,
});

export const attendanceExportQuerySchema = z.object({
  status: z.nativeEnum(AttendanceStatus).optional(),
  q: optionalBoundedQuery,
  from: optionalIsoDateParam,
  to: optionalIsoDateParam,
});
