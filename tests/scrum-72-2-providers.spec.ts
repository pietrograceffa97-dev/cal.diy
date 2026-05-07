import { expect, test } from "@playwright/test";

const BOOKER_NAME = "Playwright Tester";
const BOOKER_EMAIL = "playwright@example.com";

// Test 2: Each provider option points at the correct destination URL or
// triggers an .ics download whose contents reflect the meeting.
test("each calendar option launches the correct provider URL or download", async ({ page, context }) => {
  await context.clearCookies();

  // PM step says /pro/30min; we route this test through /pro/60min instead so
  // the three SCRUM-72 specs can run in parallel without colliding on the
  // single "first available" slot of the 30-min event type. The behavior under
  // test (provider URL/ICS download mapping) is event-type-agnostic.
  await page.goto("/pro/60min");

  await page.locator('[data-testid="incrementMonth"]').waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().click();
  await page.locator('[data-testid="time"]').first().click();

  await page.fill('[name="name"]', BOOKER_NAME);
  await page.fill('[name="email"]', BOOKER_EMAIL);
  await page.click('[data-testid="confirm-book-button"]');

  await page.getByTestId("booking-success-add-to-calendar-trigger").click();

  // Google → calendar.google.com event-creation URL with the title and time
  const googleHref = await page
    .getByTestId("booking-success-add-to-calendar-google")
    .getAttribute("href");
  expect(googleHref).toContain("https://calendar.google.com/calendar/r/eventedit");
  expect(googleHref).toContain("dates=");
  expect(googleHref).toContain("text=");
  expect(
    await page.getByTestId("booking-success-add-to-calendar-google").getAttribute("target")
  ).toBe("_blank");

  // Outlook → outlook.live.com deeplink, opens in new tab
  const outlookHref = await page
    .getByTestId("booking-success-add-to-calendar-outlook")
    .getAttribute("href");
  expect(outlookHref).toContain("https://outlook.live.com/calendar/0/deeplink/compose");
  expect(
    await page.getByTestId("booking-success-add-to-calendar-outlook").getAttribute("target")
  ).toBe("_blank");

  // Apple Calendar → ICS download (data:text/calendar with a download filename)
  const appleHref = await page
    .getByTestId("booking-success-add-to-calendar-apple")
    .getAttribute("href");
  const appleDownload = await page
    .getByTestId("booking-success-add-to-calendar-apple")
    .getAttribute("download");
  expect(appleHref).toMatch(/^data:text\/calendar/);
  expect(appleDownload).toMatch(/\.ics$/);

  // Download .ics → same data URL with .ics download filename, content reflects the meeting
  const icsHref = await page.getByTestId("booking-success-add-to-calendar-ics").getAttribute("href");
  const icsDownload = await page
    .getByTestId("booking-success-add-to-calendar-ics")
    .getAttribute("download");
  expect(icsHref).toMatch(/^data:text\/calendar/);
  expect(icsDownload).toMatch(/\.ics$/);

  // Decode the ICS payload and confirm it carries the event metadata
  const decoded = decodeURIComponent((icsHref ?? "").replace(/^data:text\/calendar,/, ""));
  expect(decoded).toContain("BEGIN:VCALENDAR");
  expect(decoded).toContain("BEGIN:VEVENT");
  expect(decoded).toContain("SUMMARY:");
  expect(decoded.toLowerCase()).toContain(BOOKER_EMAIL.toLowerCase());
});
