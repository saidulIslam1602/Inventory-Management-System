import { z } from "zod";

/** Normalize URL / form empty values to `undefined` for optional fields. */
export const emptyToUndefined = (v: unknown) =>
  v === "" || v === undefined || v === null ? undefined : v;

/** Optional CUID from a query string or form field (empty → undefined). */
export const optionalCuidParam = z.preprocess(
  emptyToUndefined,
  z.string().cuid("Invalid record identifier.").optional()
);

/**
 * Filter / search text from query strings. Empty → undefined.
 * Caps length to limit abuse of `contains` filters.
 */
export const optionalBoundedQuery = z.preprocess(
  emptyToUndefined,
  z.string().max(200, "Search text is too long").optional()
);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date YYYY-MM-DD from exports / filters (empty → undefined). */
export const optionalIsoDateParam = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(ISO_DATE, "Invalid date (use YYYY-MM-DD)")
    .refine((s) => {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    }, "Invalid calendar date")
    .optional()
);

/** Authenticated global search `q` (allow empty string; cap length). */
export const globalSearchQuerySchema = z.object({
  q: z
    .string()
    .max(200, "Query is too long")
    .transform((s) => s.trim()),
});
