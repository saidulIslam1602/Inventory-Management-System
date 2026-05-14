/**
 * Request-scoped logger helpers (reads `x-request-id` set by `src/proxy.ts` middleware).
 */

import { headers } from "next/headers";
import { logger } from "@/lib/logger";

/** Returns middleware-provided id when invoked inside a request (otherwise `undefined`). */
export async function getRequestId(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}

/** Child logger with `requestId` binding when the header is present. */
export async function requestLogger() {
  const requestId = await getRequestId();
  return requestId ? logger.child({ requestId }) : logger;
}
