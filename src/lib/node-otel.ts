/**
 * Minimal Node tracer bootstrap — OTLP HTTP exporter.
 * Enable with **`OTEL_ENABLED=true`** and point **`OTEL_EXPORTER_OTLP_ENDPOINT`** at your collector (defaults to local dev URL below).
 * Optional **`OTEL_EXPORTER_OTLP_HEADERS`** — comma-separated `Key=Value` pairs (vendor API keys).
 */

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { parseOtlpHeaders } from "@/lib/otlp-env";

let registered = false;

export function registerNodeOpenTelemetry(): void {
  if (registered) return;
  registered = true;

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || "http://localhost:4318/v1/traces";

  const headers = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  const exporter = new OTLPTraceExporter({ url: endpoint, ...(headers ? { headers } : {}) });

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME?.trim() || "aqila-ims",
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  provider.register();
}
