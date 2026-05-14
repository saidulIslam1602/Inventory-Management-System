import { test, expect } from "@playwright/test";

test.describe("public smoke", () => {
  test("login shell renders", async ({ page }) => {
    test.skip(
      process.env.PLAYWRIGHT_RUN !== "1",
      "Set PLAYWRIGHT_RUN=1 and start the app (PLAYWRIGHT_BASE_URL)."
    );

    await page.goto("/login");
    await expect(page.getByText("Sign in to your account to continue")).toBeVisible({
      timeout: 20_000,
    });
  });
});
