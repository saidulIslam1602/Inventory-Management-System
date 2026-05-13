/**
 * Integration tests require Postgres + applied migrations (CI wires both).
 */

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error("DATABASE_URL must be set for integration tests.");
}
