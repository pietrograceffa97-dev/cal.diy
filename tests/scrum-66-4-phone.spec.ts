import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 4: Phone variant uses directional copy
test("phone variant: 'host will call you at <number>' style copy", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/pro/phone-event-type");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);

  // Phone-typed event types ask for the booker's phone number on the form.
  const phoneInput = page.locator('input[type="tel"], input[name*="phone" i]').first();
  if (await phoneInput.isVisible().catch(() => false)) {
    await phoneInput.fill("+15551234567");
  }

  await page.click('[data-testid="confirm-book-button"]');

  const locationRow = page.getByTestId("booking-success-location");
  await expect(locationRow).toBeVisible();
  await expect(locationRow).toHaveAttribute("data-variant", "phone");

  const phoneLine = page.getByTestId("booking-success-location-phone");
  await expect(phoneLine).toBeVisible();
  // Directional copy: must mention the host calling the booker, not just a bare number.
  await expect(phoneLine).toContainText(/host/i);
  await expect(phoneLine).toContainText(/call/i);
});
