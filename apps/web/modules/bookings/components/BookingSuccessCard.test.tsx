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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@calcom/ui/components/dialog", () => {
  type Children = { children?: React.ReactNode };
  return {
    Dialog: ({ open, children }: Children & { open?: boolean }) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children }: Children) => <div>{children}</div>,
  };
});

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
  location: "https://meet.daily.co/test",
  startTime: "2026-05-15T10:00:00.000Z",
  rawEndTime: "2026-05-15T10:30:00.000Z",
};

describe("BookingSuccessCard", () => {
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
});
