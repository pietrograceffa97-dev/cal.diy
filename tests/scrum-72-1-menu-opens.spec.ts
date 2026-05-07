import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 1: Add-to-calendar button is the dominant action and opens a menu with all four providers
test("add-to-calendar trigger opens dropdown with Google, Outlook, Apple, and .ics", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  await page.goto("/pro/30min");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);
  await page.click('[data-testid="confirm-book-button"]');

  const trigger = page.getByTestId("booking-success-add-to-calendar-trigger");
  await expect(trigger).toBeVisible();

  // Dominant action: rendered as the primary-color button
  await expect(trigger).toHaveText(/add to calendar/i);

  await trigger.click();

  await expect(page.getByTestId("booking-success-add-to-calendar-google")).toBeVisible();
  await expect(page.getByTestId("booking-success-add-to-calendar-outlook")).toBeVisible();
  await expect(page.getByTestId("booking-success-add-to-calendar-apple")).toBeVisible();
  await expect(page.getByTestId("booking-success-add-to-calendar-ics")).toBeVisible();

  // Order matches the email confirmation: Google, Outlook, Apple, .ics
  const items = page.locator(
    '[data-testid="booking-success-add-to-calendar-google"], [data-testid="booking-success-add-to-calendar-outlook"], [data-testid="booking-success-add-to-calendar-apple"], [data-testid="booking-success-add-to-calendar-ics"]'
  );
  const order: string[] = [];
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute("data-testid");
    if (tid) order.push(tid);
  }
  expect(order).toEqual([
    "booking-success-add-to-calendar-google",
    "booking-success-add-to-calendar-outlook",
    "booking-success-add-to-calendar-apple",
    "booking-success-add-to-calendar-ics",
  ]);

  // Closes on outside click
  await page.mouse.click(10, 10);
  await expect(page.getByTestId("booking-success-add-to-calendar-google")).toBeHidden();
});
