import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 5: TBD variant shows explicit placeholder copy
test("tbd variant: 'host will share the location' explicit copy", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/pro/tbd-event-type");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);
  await page.click('[data-testid="confirm-book-button"]');

  const locationRow = page.getByTestId("booking-success-location");
  await expect(locationRow).toBeVisible();
  await expect(locationRow).toHaveAttribute("data-variant", "tbd");

  const tbdLine = page.getByTestId("booking-success-location-tbd");
  await expect(tbdLine).toBeVisible();
  // Explicit copy: must reference the host sharing the location, not be empty.
  await expect(tbdLine).toContainText(/host/i);
  await expect(tbdLine).toContainText(/(share|location|before)/i);
});
