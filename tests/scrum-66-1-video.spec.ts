import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 1: Video link variant exposes Join control, URL, and copy-to-clipboard
test("video variant: Join + URL + copy-to-clipboard with transient feedback", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/pro/30min");

  // Pick first available day in the calendar grid
  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();

  // First available time slot
  await page.locator('[data-testid="time"]').first().click();

  // Booker form
  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);

  await page.click('[data-testid="confirm-book-button"]');

  // Confirmation page renders the success card
  const locationRow = page.getByTestId("booking-success-location");
  await expect(locationRow).toBeVisible();
  await expect(locationRow).toHaveAttribute("data-variant", "video");

  // Join affordance + URL + copy control all present
  await expect(page.getByTestId("booking-success-location-join")).toBeVisible();
  await expect(page.getByTestId("booking-success-location-url")).toBeVisible();
  const copyButton = page.getByTestId("booking-success-location-copy");
  await expect(copyButton).toBeVisible();

  // Click copy → transient "Copied" state appears
  await copyButton.click();
  await expect(page.getByTestId("booking-success-location-copied")).toBeVisible();

  // Clipboard contains the URL
  const urlText = (await page.getByTestId("booking-success-location-url").textContent()) ?? "";
  const clipboardContent: string = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardContent.trim()).toBe(urlText.trim());

  // Feedback fades after the configured ~1.5s window
  await expect(page.getByTestId("booking-success-location-copied")).toBeHidden({ timeout: 3000 });
});
