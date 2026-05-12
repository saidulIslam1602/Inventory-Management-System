import { z } from "zod";
import { UserRole } from "@prisma/client";

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(UserRole),
  employeeCode: z
    .string()
    .max(20)
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined)),
  hireDate: z.coerce.date(),
  locationId: z.string().cuid("Invalid location"),
  departmentId: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s : undefined))
    .pipe(z.union([z.undefined(), z.string().cuid("Invalid department")])),
  phone: z
    .string()
    .max(50)
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined)),
  address: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined)),
  photoUrl: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined))
    .pipe(z.union([z.undefined(), z.string().url("Invalid image URL")])),
  isActive: z.coerce.boolean().optional().default(true),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  employeeId: z.string().cuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  employeeCode: z.string().min(1, "Employee code is required").max(20),
  hireDate: z.coerce.date(),
  locationId: z.string().cuid(),
  departmentId: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s : undefined))
    .pipe(z.union([z.undefined(), z.string().cuid()])),
  phone: z
    .string()
    .max(50)
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined)),
  address: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined)),
  photoUrl: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined))
    .pipe(z.union([z.undefined(), z.string().url()])),
  isActive: z.coerce.boolean(),
  newPassword: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s : undefined))
    .pipe(
      z.union([z.undefined(), z.string().min(8, "New password must be at least 8 characters")])
    ),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
