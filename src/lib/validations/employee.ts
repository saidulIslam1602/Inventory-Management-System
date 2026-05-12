import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";

export const employeeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  hireDate: z.coerce.date(),
  locationId: z.string().cuid("Invalid location"),
  departmentId: z.string().cuid("Invalid department").optional(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const attendanceSchema = z.object({
  employeeId: z.string().cuid(),
  date: z.coerce.date(),
  status: z.nativeEnum(AttendanceStatus),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export type AttendanceInput = z.infer<typeof attendanceSchema>;

export const shiftSchema = z.object({
  employeeId: z.string().cuid(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export type ShiftInput = z.infer<typeof shiftSchema>;
