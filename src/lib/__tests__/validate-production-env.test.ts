import { assertProductionEnvironment } from "@/lib/validate-production-env";

const KEYS = [
  "NODE_ENV",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "AUTH_URL",
  "CRON_SECRET",
  "OTEL_ENABLED",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
] as const;
const env = process.env as Record<string, string | undefined>;

describe("assertProductionEnvironment", () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {};
    for (const k of KEYS) snapshot[k] = env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      const v = snapshot[k];
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  });

  test("no-op when NODE_ENV is not production", () => {
    env.NODE_ENV = "test";
    delete env.AUTH_SECRET;
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production rejects missing AUTH_SECRET", () => {
    env.NODE_ENV = "production";
    delete env.AUTH_SECRET;
    env.NEXTAUTH_URL = "https://ims.example.com";
    expect(() => assertProductionEnvironment()).toThrow(/AUTH_SECRET/);
  });

  test("production rejects short AUTH_SECRET", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(31);
    env.NEXTAUTH_URL = "https://ims.example.com";
    expect(() => assertProductionEnvironment()).toThrow(/AUTH_SECRET/);
  });

  test("production rejects missing public URL", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    delete env.NEXTAUTH_URL;
    delete env.AUTH_URL;
    expect(() => assertProductionEnvironment()).toThrow(/NEXTAUTH_URL/);
  });

  test("production accepts AUTH_URL when NEXTAUTH_URL unset", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    delete env.NEXTAUTH_URL;
    env.AUTH_URL = "https://auth.example.com";
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production rejects http except localhost / 127.0.0.1", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "http://ims.example.com";
    expect(() => assertProductionEnvironment()).toThrow(/https/);
  });

  test("production allows http localhost", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "http://localhost:3020";
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production allows https URL", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production rejects short CRON_SECRET when set", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    env.CRON_SECRET = "x".repeat(23);
    expect(() => assertProductionEnvironment()).toThrow(/CRON_SECRET/);
  });

  test("production allows unset CRON_SECRET", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    delete env.CRON_SECRET;
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production accepts long CRON_SECRET when set", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    env.CRON_SECRET = "x".repeat(24);
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production rejects OTEL_ENABLED without OTLP endpoint", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    env.OTEL_ENABLED = "true";
    delete env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(() => assertProductionEnvironment()).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT/);
  });

  test("production rejects plaintext OTLP to non-localhost", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    env.OTEL_ENABLED = "true";
    env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector.internal/v1/traces";
    expect(() => assertProductionEnvironment()).toThrow(/https/);
  });

  test("production accepts https OTLP endpoint when OTEL enabled", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    env.OTEL_ENABLED = "true";
    env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel.example.com/v1/traces";
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production allows http OTLP to localhost when OTEL enabled", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    env.OTEL_ENABLED = "true";
    env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:4318/v1/traces";
    expect(() => assertProductionEnvironment()).not.toThrow();
  });

  test("production ignores OTEL when disabled", () => {
    env.NODE_ENV = "production";
    env.AUTH_SECRET = "x".repeat(32);
    env.NEXTAUTH_URL = "https://ims.example.com";
    delete env.OTEL_ENABLED;
    delete env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(() => assertProductionEnvironment()).not.toThrow();
  });
});
