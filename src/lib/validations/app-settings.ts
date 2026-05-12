import { z } from "zod";

export const exceptionThresholdSettingsSchema = z.object({
  exceptionStaleSubmitDays: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(1, "Stale submit days must be between 1 and 30.")
    .max(30, "Stale submit days must be between 1 and 30."),
  exceptionOverdueReceiveDays: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(1, "Overdue receive days must be between 1 and 90.")
    .max(90, "Overdue receive days must be between 1 and 90."),
  exceptionMinLowStockBranches: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(1, "The low-stock branch threshold must be between 1 and 50.")
    .max(50, "The low-stock branch threshold must be between 1 and 50."),
});

export type ExceptionThresholdSettingsInput = z.infer<typeof exceptionThresholdSettingsSchema>;
