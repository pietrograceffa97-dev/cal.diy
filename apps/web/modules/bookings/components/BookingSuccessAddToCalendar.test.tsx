import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    i18n: {},
    isLocaleReady: true,
  }),
}));

// Radix DropdownMenu uses a portal and pointer events that jsdom does not
// implement, so it cannot be opened in a unit test. We mock the menu pieces
// to render their children inline — this lets us assert the items, their hrefs,
// and the download attributes without driving the menu open/close lifecycle
// (which is covered end-to-end by the Playwright suite).
vi.mock("@calcom/ui/components/dropdown", async () => {
  const React = await import("react");
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const AsChildPass = ({
    children,
    asChild: _asChild,
    ...rest
  }: {
    children?: React.ReactNode;
    asChild?: boolean;
  }) => {
    if (React.isValidElement(children)) {
      return React.cloneElement(children, rest);
    }
    return <>{children}</>;
  };
  return {
    Dropdown: Pass,
    DropdownMenuTrigger: AsChildPass,
    DropdownMenuContent: ({ children, ...rest }: { children?: React.ReactNode }) => {
      const { align: _align, sideOffset: _sideOffset, ...domProps } = rest as Record<string, unknown>;
      return <div {...domProps}>{children}</div>;
    },
    DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownItem: ({
      children,
      href,
      download,
      target,
      rel,
      disabled,
      ...rest
    }: {
      children?: React.ReactNode;
      href?: string;
      download?: string;
      target?: string;
      rel?: string;
      disabled?: boolean;
    } & Record<string, unknown>) => (
      <a
        href={href}
        download={download}
        target={target}
        rel={rel}
        aria-disabled={disabled || undefined}
        {...rest}>
        {children}
      </a>
    ),
  };
});

import { BookingSuccessAddToCalendar } from "./BookingSuccessAddToCalendar";

const baseProps = {
  title: "Sales Sync",
  startTime: "2026-05-15T10:00:00.000Z",
  endTime: "2026-05-15T10:30:00.000Z",
  location: "https://meet.example.com/abc",
  attendees: [{ name: "Ada Lovelace", email: "ada@example.com" }],
  organizer: { name: "Pro User", email: "pro@example.com" },
};

describe("BookingSuccessAddToCalendar", () => {
  it("renders the primary trigger button labeled with the i18n key", () => {
    render(<BookingSuccessAddToCalendar {...baseProps} />);
    const trigger = screen.getByTestId("booking-success-add-to-calendar-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("add_to_calendar");
  });

  it("renders all four provider items with localized labels", () => {
    render(<BookingSuccessAddToCalendar {...baseProps} />);
    expect(screen.getByTestId("booking-success-add-to-calendar-google")).toHaveTextContent(
      "google_calendar"
    );
    expect(screen.getByTestId("booking-success-add-to-calendar-outlook")).toHaveTextContent("outlook");
    expect(screen.getByTestId("booking-success-add-to-calendar-apple")).toHaveTextContent("apple_calendar");
    expect(screen.getByTestId("booking-success-add-to-calendar-ics")).toHaveTextContent("download_ics");
  });

  it("Google option points to calendar.google.com with title and time encoded", () => {
    render(<BookingSuccessAddToCalendar {...baseProps} />);
    const link = screen.getByTestId("booking-success-add-to-calendar-google") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("https://calendar.google.com/calendar/r/eventedit");
    expect(link.getAttribute("href")).toContain("text=Sales Sync");
    expect(link.getAttribute("href")).toContain("20260515T100000Z/20260515T103000Z");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("Outlook option points to outlook.live.com and opens in a new tab", () => {
    render(<BookingSuccessAddToCalendar {...baseProps} />);
    const link = screen.getByTestId("booking-success-add-to-calendar-outlook") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("https://outlook.live.com/calendar/0/deeplink/compose");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("Apple Calendar and Download .ics options trigger an .ics download with the booking title", () => {
    render(<BookingSuccessAddToCalendar {...baseProps} />);
    const apple = screen.getByTestId("booking-success-add-to-calendar-apple") as HTMLAnchorElement;
    const ics = screen.getByTestId("booking-success-add-to-calendar-ics") as HTMLAnchorElement;

    expect(apple.getAttribute("href")).toMatch(/^data:text\/calendar/);
    expect(apple.getAttribute("download")).toBe("sales-sync.ics");
    expect(ics.getAttribute("href")).toMatch(/^data:text\/calendar/);
    expect(ics.getAttribute("download")).toBe("sales-sync.ics");
  });
});
