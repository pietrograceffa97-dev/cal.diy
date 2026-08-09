import { expect, test } from "@playwright/test";

/**
 * The public booking page still works.
 *
 * This is the journey that matters most: a stranger with a link can see the
 * event and is offered times to book. If this breaks, cal.diy is down for the
 * only people who don't have another way in.
 *
 * Every selector here is a `data-testid` that the booker renders in
 * production — verified against the live page, not guessed from the source.
 */
test("public booking page loads and offers time slots", async ({ page }) => {
  await page.goto("/pro/30min", { waitUntil: "domcontentloaded" });

  // The booker mounted — not merely a 200 with a shell.
  await expect(page.getByTestId("booker-container")).toBeVisible();

  // The right event, so a routing regression can't pass as healthy.
  await expect(page.getByTestId("event-title")).toHaveText("30min");

  // Slots are the real assertion: they only appear once the availability
  // lookup has answered, so this covers the API and the calendar, not just
  // that the page rendered.
  const slots = page.getByTestId("time");
  await expect(slots.first()).toBeVisible();

  // ...and they say an actual time. An empty slot button would otherwise
  // satisfy "visible" while telling the visitor nothing. Matches both
  // "10:00am" and "10:00".
  await expect(slots.first()).toHaveText(/\d{1,2}:\d{2}/);
});
