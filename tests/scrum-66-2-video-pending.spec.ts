import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 2: Video-pending variant reassures the booking is confirmed
test("video-pending variant: link-arriving-by-email notice", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/pro/video-pending-event-type");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);
  await page.click('[data-testid="confirm-book-button"]');

  const locationRow = page.getByTestId("booking-success-location");
  await expect(locationRow).toBeVisible();
  await expect(locationRow).toHaveAttribute("data-variant", "video-pending");

  const pendingNotice = page.getByTestId("booking-success-location-video-pending");
  await expect(pendingNotice).toBeVisible();
  // Reassures: link will arrive by email, booking is confirmed
  await expect(pendingNotice).toContainText(/email/i);
  await expect(pendingNotice).toContainText(/confirm/i);
});
