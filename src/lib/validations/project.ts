import { z } from "zod";
import { ProjectStatus } from "@prisma/client";

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  locationId: z.string().cuid("Invalid location"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const projectStatusSchema = z.object({
  projectId: z.string().cuid(),
  status: z.nativeEnum(ProjectStatus),
});

export const addProjectMaterialSchema = z.object({
  projectId: z.string().cuid(),
  productId: z.string().cuid(),
  reservedQuantity: z.coerce.number().positive("Quantity must be greater than 0"),
});

export type AddProjectMaterialInput = z.infer<typeof addProjectMaterialSchema>;

export const consumeMaterialSchema = z.object({
  projectMaterialId: z.string().cuid(),
  usedQuantity: z.coerce.number().positive("Used quantity must be greater than 0"),
});

export type ConsumeMaterialInput = z.infer<typeof consumeMaterialSchema>;
