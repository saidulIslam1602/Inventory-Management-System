import { defineConfig } from "@playwright/test";

/**
 * Optional UI smoke tests. Run locally after `npx playwright install`:
 *   PLAYWRIGHT_RUN=1 PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010",
    trace: "on-first-retry",
  },
});
