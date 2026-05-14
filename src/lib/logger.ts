/**
 * Structured logging for Node.js server runtime (Route Handlers, Server Actions, Prisma callers).
 * Edge middleware — use request correlation only; do not import this module there.
 */

import pino from "pino";

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

export type LogLevel = (typeof LEVELS)[number];

export function parseLogLevel(raw: string | undefined): LogLevel {
  const fallback: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";
  if (!raw?.trim()) return fallback;
  const v = raw.trim().toLowerCase();
  return (LEVELS as readonly string[]).includes(v) ? (v as LogLevel) : fallback;
}

const usePrettyTransport = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export const logger = pino({
  level: parseLogLevel(process.env.LOG_LEVEL),
  ...(usePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
