import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v);

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.preprocess(emptyToUndefined, z.string().email("Invalid email").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().max(80).optional()),
  address: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().cuid("Invalid customer identifier."),
  isActive: z.boolean(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
