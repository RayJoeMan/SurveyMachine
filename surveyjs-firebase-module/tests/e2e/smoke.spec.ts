import { expect, test } from "@playwright/test";

test("landing page exposes respondent and admin entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /feedback that builds better programs/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open demo survey/i })).toHaveAttribute(
    "href",
    "/s/demo-end-of-season",
  );
  await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/admin");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
});

test("unknown routes show a useful recovery action", async ({ page }) => {
  await page.goto("/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
});
