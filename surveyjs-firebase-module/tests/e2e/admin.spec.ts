import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);
test.beforeEach(({ page }) => {
  page.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(45_000);
});

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@example.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "LocalOnly123!";

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test("admin shell exposes the new management entry points", async ({ page }) => {
  await signInAsAdmin(page);
  const nav = page.getByRole("navigation", { name: "Administration" });
  await expect(nav.getByRole("link", { name: "Surveys" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Members" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Billing" })).toBeVisible();
});

test("billing page shows plan cards with configured prices", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enterprise" })).toBeVisible();
});

test("members page lists members and offers the invite form to admins", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await page.goto("/admin/members");
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(ADMIN_EMAIL) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite someone" })).toBeVisible();
});

test("settings page updates organization branding colors", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page
    .locator("label")
    .filter({ hasText: "Primary" })
    .locator('input[type="text"]')
    .fill("#000000");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status").first()).toContainText("Settings saved.");
});

test("report page exposes the AI ask box", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/surveys/demo-end-of-season/report");
  await expect(page.getByRole("heading", { name: "Ask about this data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask" })).toBeVisible();
});
