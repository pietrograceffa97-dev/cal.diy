import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 3: Address variant shows venue name and full address
test("address variant: venue name + full address", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/pro/in-person-event-type");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);
  await page.click('[data-testid="confirm-book-button"]');

  const locationRow = page.getByTestId("booking-success-location");
  await expect(locationRow).toBeVisible();
  await expect(locationRow).toHaveAttribute("data-variant", "address");

  const addressBlock = page.getByTestId("booking-success-location-address");
  await expect(addressBlock).toBeVisible();

  const text = (await addressBlock.textContent()) ?? "";
  // Should contain real address content — not just a bare 'address' label.
  expect(text.trim().length).toBeGreaterThan(5);
  expect(text.trim().toLowerCase()).not.toBe("address");
});
