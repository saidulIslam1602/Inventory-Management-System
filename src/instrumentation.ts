/**
 * Next.js instrumentation hook — runs once per Node.js server process.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertProductionEnvironment } = await import("@/lib/validate-production-env");
  assertProductionEnvironment();

  if (process.env.OTEL_ENABLED === "true") {
    const { registerNodeOpenTelemetry } = await import("@/lib/node-otel");
    registerNodeOpenTelemetry();
  }
}
