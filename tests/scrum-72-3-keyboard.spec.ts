import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 3: Keyboard accessibility — open via Enter, navigate via Arrow keys,
// activate via Enter, and close via Escape returning focus to the trigger.
test("add-to-calendar menu is keyboard-accessible end-to-end", async ({ page, context }) => {
  await context.clearCookies();

  // PM step says /pro/30min; we route this test through /pro/daily instead so
  // the three SCRUM-72 specs can run in parallel without colliding on the
  // single "first available" slot of the 30-min event type. The keyboard
  // behavior under test is event-type-agnostic.
  await page.goto("/pro/daily");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);
  await page.click('[data-testid="confirm-book-button"]');

  const trigger = page.getByTestId("booking-success-add-to-calendar-trigger");
  await expect(trigger).toBeVisible();

  // Focus the trigger from the keyboard. We don't depend on the natural Tab
  // order of upstream elements (which can vary across builds) — what matters
  // for the a11y guarantee is that focus lands here without a mouse and the
  // menu reacts to keyboard events from there.
  await trigger.focus();
  await expect(trigger).toBeFocused();

  // Open the menu via Enter
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("booking-success-add-to-calendar-google")).toBeVisible();

  // First item is auto-focused by Radix. ArrowDown moves focus to the second
  // (Outlook). We assert focus has moved off Google and onto Outlook.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("booking-success-add-to-calendar-outlook")).toBeFocused();

  // Activate Outlook via Enter — the menu closes after selection
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("booking-success-add-to-calendar-google")).toBeHidden();

  // Re-open the menu with the keyboard, then close with Escape
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("booking-success-add-to-calendar-google")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("booking-success-add-to-calendar-google")).toBeHidden();

  // Focus returns to the trigger after Escape
  await expect(trigger).toBeFocused();
});
