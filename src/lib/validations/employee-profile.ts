import { z } from "zod";

export const myProfileSchema = z.object({
  phone: z
    .string()
    .max(40)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  address: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  nationality: z
    .string()
    .max(80)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});
