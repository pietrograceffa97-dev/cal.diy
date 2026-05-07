import { describe, expect, it } from "vitest";

import { buildSuccessCardCalendarLinks } from "./buildSuccessCardCalendarLinks";

const fixed = {
  title: "Quarterly Review",
  startTime: "2026-05-15T14:00:00.000Z",
  endTime: "2026-05-15T15:00:00.000Z",
  description: null,
  location: "https://meet.example.com/q-review",
  attendees: [{ name: "Ada Lovelace", email: "ada@example.com" }],
  organizer: { name: "Pro User", email: "pro@example.com" },
};

describe("buildSuccessCardCalendarLinks", () => {
  it("returns Google link with UTC times and encoded title", () => {
    const { googleCalendar } = buildSuccessCardCalendarLinks(fixed);
    expect(googleCalendar).toContain("https://calendar.google.com/calendar/r/eventedit");
    expect(googleCalendar).toContain("dates=20260515T140000Z/20260515T150000Z");
    expect(googleCalendar).toContain("text=Quarterly Review");
    expect(googleCalendar).toContain(`location=${encodeURIComponent(fixed.location)}`);
  });

  it("returns Outlook link to outlook.live.com", () => {
    const { outlook } = buildSuccessCardCalendarLinks(fixed);
    expect(outlook).toContain("https://outlook.live.com/calendar/0/deeplink/compose");
    expect(outlook).toContain("subject=Quarterly%20Review");
  });

  it("returns Microsoft Office link to outlook.office.com", () => {
    const { microsoftOffice } = buildSuccessCardCalendarLinks(fixed);
    expect(microsoftOffice).toContain("https://outlook.office.com/calendar/0/deeplink/compose");
  });

  it("returns ICS data URL containing title and attendees", () => {
    const { ics } = buildSuccessCardCalendarLinks(fixed);
    expect(ics).toMatch(/^data:text\/calendar/);
    const decoded = decodeURIComponent(ics.replace(/^data:text\/calendar,/, ""));
    expect(decoded).toContain("SUMMARY:Quarterly Review");
    expect(decoded).toContain("ada@example.com");
    expect(decoded).toContain("pro@example.com");
  });

  it("still returns Google/Outlook/Office links if attendees are absent", () => {
    const { googleCalendar, outlook, microsoftOffice, ics } = buildSuccessCardCalendarLinks({
      title: "Solo focus",
      startTime: "2026-05-15T14:00:00.000Z",
      endTime: "2026-05-15T15:00:00.000Z",
    });
    expect(googleCalendar).toContain("calendar.google.com");
    expect(outlook).toContain("outlook.live.com");
    expect(microsoftOffice).toContain("outlook.office.com");
    expect(ics).toMatch(/^data:text\/calendar/);
  });
});
