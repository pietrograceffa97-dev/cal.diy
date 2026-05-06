import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingSuccessLocationRow } from "./BookingSuccessLocationRow";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      if (vars && Object.keys(vars).length > 0) {
        // Append the interpolation values so tests can assert on them even
        // though we don't have the real English string here.
        return `${key} ${Object.values(vars).join(" ")}`;
      }
      return key;
    },
    i18n: {},
    isLocaleReady: true,
  }),
}));

describe("BookingSuccessLocationRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders video variant with Join affordance, URL, and copy button", () => {
    render(<BookingSuccessLocationRow location="https://meet.daily.co/abc-123" />);

    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "video");
    expect(screen.getByTestId("booking-success-location-join")).toHaveTextContent("join_meeting");
    expect(screen.getByTestId("booking-success-location-url")).toHaveTextContent(
      "https://meet.daily.co/abc-123"
    );
    expect(screen.getByTestId("booking-success-location-copy")).toBeInTheDocument();
  });

  it("shows transient 'Copied' feedback after clicking copy button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<BookingSuccessLocationRow location="https://meet.daily.co/abc-123" />);

    fireEvent.click(screen.getByTestId("booking-success-location-copy"));

    await waitFor(() => {
      expect(screen.getByTestId("booking-success-location-copied")).toBeInTheDocument();
    });

    expect(writeText).toHaveBeenCalledWith("https://meet.daily.co/abc-123");

    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(screen.queryByTestId("booking-success-location-copied")).not.toBeInTheDocument();
    });
  });

  it("renders video-pending variant with reassurance copy", () => {
    render(<BookingSuccessLocationRow location="integrations:daily" />);

    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "video-pending");
    expect(screen.getByTestId("booking-success-location-video-pending")).toHaveTextContent(
      "booking_location_video_pending_message"
    );
  });

  it("renders address variant with venue and street", () => {
    render(<BookingSuccessLocationRow location={"Cal HQ\n123 Market Street, San Francisco"} />);

    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "address");
    const block = screen.getByTestId("booking-success-location-address");
    expect(block).toHaveTextContent("Cal HQ");
    expect(block).toHaveTextContent("123 Market Street, San Francisco");
  });

  it("renders phone variant with directional copy and the number", () => {
    render(<BookingSuccessLocationRow location="+15551234567" />);

    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "phone");
    expect(screen.getByTestId("booking-success-location-phone")).toHaveTextContent("+15551234567");
    // The translation key carries the directional copy when actually rendered
    expect(screen.getByTestId("booking-success-location-phone")).toHaveTextContent(
      "booking_location_phone_directional"
    );
  });

  it("renders tbd variant for null location", () => {
    render(<BookingSuccessLocationRow location={null} />);

    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "tbd");
    expect(screen.getByTestId("booking-success-location-tbd")).toHaveTextContent(
      "booking_location_tbd_message"
    );
  });

  it("renders tbd variant for somewhereElse location type", () => {
    render(<BookingSuccessLocationRow location="somewhereElse" />);
    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "tbd");
  });
});
