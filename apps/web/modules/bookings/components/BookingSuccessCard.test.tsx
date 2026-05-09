import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars && Object.keys(vars).length > 0 ? `${key} ${Object.values(vars).join(" ")}` : key,
    i18n: {},
    isLocaleReady: true,
  }),
}));

vi.mock("@calcom/lib/defaultAvatarImage", () => ({
  getPlaceholderAvatar: () => "/placeholder.png",
}));

vi.mock("@calcom/ui/components/avatar", () => ({
  Avatar: ({ alt }: { alt?: string }) => <span data-testid="avatar">{alt}</span>,
}));

vi.mock("@calcom/ui/components/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@coss/ui/icons", () => ({
  CheckIcon: (props: Record<string, unknown>) => <svg data-testid="check-icon" {...props} />,
  XIcon: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  CopyIcon: (props: Record<string, unknown>) => <svg {...props} />,
}));

vi.mock("./BookingSuccessActions", () => ({
  BookingSuccessActions: () => <div data-testid="actions" />,
}));

vi.mock("./BookingSuccessAddToCalendar", () => ({
  BookingSuccessAddToCalendar: () => <div data-testid="add-to-calendar" />,
}));

import { BookingSuccessCard, type BookingSuccessCardProps } from "./BookingSuccessCard";

const baseProps: BookingSuccessCardProps = {
  uid: "abc123",
  title: "Sales Sync",
  formattedDate: "Friday, May 15, 2026",
  formattedTime: "10:00 AM",
  endTime: "10:30 AM",
  formattedTimeZone: "UTC",
  hostName: "Sam Host",
  hostEmail: "sam@example.com",
  hostAvatarUrl: null,
  attendeeName: "Alex Booker",
  attendeeEmail: "alex@example.com",
  additionalInvitees: [],
  location: null,
  startTime: "2026-05-15T10:00:00.000Z",
  rawEndTime: "2026-05-15T10:30:00.000Z",
};

describe("BookingSuccessCard a11y & mobile polish", () => {
  it("does not assert role=dialog or aria-modal on the success panel (it is not a modal)", () => {
    const { container } = render(<BookingSuccessCard {...baseProps} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it("uses <main> as the page landmark and labels it via the success headline", () => {
    const { container } = render(<BookingSuccessCard {...baseProps} />);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute("aria-labelledby", "booking-success-headline");
    const headline = container.querySelector("#booking-success-headline");
    expect(headline?.tagName).toBe("H1");
  });

  it("hides the decorative success check icon from assistive tech (the headline conveys it)", () => {
    render(<BookingSuccessCard {...baseProps} />);
    const icon = screen.getByTestId("check-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a darker green for the success check icon in light mode (WCAG 1.4.11 non-text contrast)", () => {
    render(<BookingSuccessCard {...baseProps} />);
    const icon = screen.getByTestId("check-icon");
    // text-green-600 (#16a34a) on bg-cal-success #e4fbed sits at ~3.0:1 — at the
    // floor of WCAG 1.4.11's 3:1 requirement. text-green-700 lifts it to ~4.6:1.
    expect(icon.getAttribute("class")).toMatch(/\btext-green-700\b/);
    expect(icon.getAttribute("class")).not.toMatch(/\btext-green-600\b/);
  });

  it("uses tighter vertical padding on mobile to keep meeting details above the fold", () => {
    const { container } = render(<BookingSuccessCard {...baseProps} />);
    const main = container.querySelector("main");
    // py-6 on mobile, sm:py-16 on tablet+. The header also drops from pt-8 → pt-6.
    expect(main?.className).toMatch(/\bpy-6\b/);
    expect(main?.className).toMatch(/\bsm:py-16\b/);
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/\bpt-6\b/);
    expect(header?.className).toMatch(/\bsm:pt-10\b/);
  });

  it("renders the meeting details inside a labelled section with a definition list", () => {
    const { container } = render(<BookingSuccessCard {...baseProps} />);
    const section = container.querySelector("section[aria-label='meeting_details']");
    expect(section).not.toBeNull();
    const dl = section?.querySelector("dl");
    expect(dl).not.toBeNull();
    // host, date, time, attendees, location → 5 dt/dd pairs
    expect(dl?.querySelectorAll("dt").length).toBeGreaterThanOrEqual(5);
  });

  it("emits the actions row with both the add-to-calendar trigger and the per-booking actions", () => {
    render(<BookingSuccessCard {...baseProps} />);
    expect(screen.getByTestId("booking-success-actions")).toBeInTheDocument();
    expect(screen.getByTestId("add-to-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("actions")).toBeInTheDocument();
  });

  // AC #6 demands no a11y regressions across all 5 location variants. The location
  // row owns its own variant rendering, but the card's a11y contract (no spurious
  // dialog role, labelled main, hidden decorative icon, mobile spacing) must hold
  // regardless of which variant is rendered inside it.
  describe.each([
    ["video", "https://meet.daily.co/abc-123"],
    ["video-pending", "integrations:daily"],
    ["address", "Cal HQ\n123 Market Street, San Francisco"],
    ["phone", "+15551234567"],
    ["tbd", null],
  ])("with the %s location variant", (_label, location) => {
    it("preserves the success-card a11y contract", () => {
      const { container } = render(<BookingSuccessCard {...baseProps} location={location} />);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      expect(container.querySelector('[aria-modal="true"]')).toBeNull();
      const main = container.querySelector("main");
      expect(main).toHaveAttribute("aria-labelledby", "booking-success-headline");
      expect(screen.getByTestId("check-icon")).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByTestId("booking-success-location")).toBeInTheDocument();
    });
  });
});

describe("BookingSuccessCard headline / subtitle (PENDING vs ACCEPTED)", () => {
  it("renders the confirmed headline and email-confirmation subtitle by default", () => {
    render(<BookingSuccessCard {...baseProps} />);

    const headline = screen.getByRole("heading", { level: 1, name: /youre_booked/ });
    expect(headline).toBeInTheDocument();
    expect(headline).toHaveTextContent("youre_booked");
    expect(headline).not.toHaveTextContent("booking_submitted");

    expect(screen.getByText(/calendar_invite_and_confirmation_sent_to/)).toHaveTextContent(
      "alex@example.com"
    );
  });

  it("renders the confirmed headline when needsConfirmation is explicitly false", () => {
    render(<BookingSuccessCard {...baseProps} needsConfirmation={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("youre_booked");
  });

  it("renders the awaiting-confirmation headline and host-aware subtitle when needsConfirmation is true", () => {
    render(<BookingSuccessCard {...baseProps} needsConfirmation={true} />);

    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent("booking_submitted");
    expect(headline).not.toHaveTextContent("youre_booked");

    expect(screen.getByText(/user_needs_to_confirm_or_reject_booking/)).toHaveTextContent("Sam Host");
  });

  it("falls back to the generic awaiting-confirmation subtitle when no approver name is known", () => {
    render(
      <BookingSuccessCard
        {...baseProps}
        hostName={null}
        confirmationApproverName={null}
        needsConfirmation={true}
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("booking_submitted");

    const subtitle = screen.getByText(/needs_to_be_confirmed_or_rejected/);
    expect(subtitle).toBeInTheDocument();
    expect(subtitle.textContent).not.toMatch(/user_needs_to_confirm_or_reject_booking/);
  });

  it("uses confirmationApproverName (e.g. team name) over hostName in the awaiting subtitle", () => {
    render(
      <BookingSuccessCard
        {...baseProps}
        confirmationApproverName="Engineering Team"
        needsConfirmation={true}
      />
    );

    const subtitle = screen.getByText(/user_needs_to_confirm_or_reject_booking/);
    expect(subtitle).toHaveTextContent("Engineering Team");
    expect(subtitle).not.toHaveTextContent("Sam Host");
  });

  it("falls back to the generic emailed-everyone subtitle for confirmed bookings without an attendee email", () => {
    render(<BookingSuccessCard {...baseProps} attendeeEmail={null} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("youre_booked");
    expect(screen.getByText("emailed_you_and_any_other_attendees")).toBeInTheDocument();
  });

  it("renders a cancelled-state headline with the e2e testid when isCancelled is true", () => {
    render(
      <BookingSuccessCard
        {...baseProps}
        isCancelled={true}
        cancellationReason="No longer needed"
        cancelledBy="alex@example.com"
      />
    );

    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent("event_cancelled");
    expect(headline).toHaveAttribute("data-testid", "cancelled-headline");
    expect(headline).not.toHaveTextContent("youre_booked");
    expect(headline).not.toHaveTextContent("booking_submitted");
  });

  it("surfaces cancellationReason and cancelledBy when the booking is cancelled", () => {
    render(
      <BookingSuccessCard
        {...baseProps}
        isCancelled={true}
        cancellationReason="No longer needed"
        cancelledBy="organizer@example.com"
      />
    );

    expect(screen.getByText("reason")).toBeInTheDocument();
    expect(screen.getByText("No longer needed")).toBeInTheDocument();
    expect(screen.getByText("cancelled_by")).toBeInTheDocument();
    expect(screen.getByText("organizer@example.com")).toBeInTheDocument();
  });

  it("hides the reschedule, cancel, and add-to-calendar actions on a cancelled booking", () => {
    render(<BookingSuccessCard {...baseProps} isCancelled={true} />);

    expect(screen.queryByTestId("booking-success-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-to-calendar")).not.toBeInTheDocument();
  });

  it("suppresses the confirmation subtitle when isCancelled is true", () => {
    render(<BookingSuccessCard {...baseProps} isCancelled={true} />);

    expect(screen.queryByText(/calendar_invite_and_confirmation_sent_to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/emailed_you_and_any_other_attendees/)).not.toBeInTheDocument();
  });

  it("does not render the reason / cancelled_by rows when those fields are missing", () => {
    render(
      <BookingSuccessCard
        {...baseProps}
        isCancelled={true}
        cancellationReason={null}
        cancelledBy={null}
      />
    );

    expect(screen.queryByText("reason")).not.toBeInTheDocument();
    expect(screen.queryByText("cancelled_by")).not.toBeInTheDocument();
  });
});
