import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BookingSuccessDecoyFallback } from "./BookingSuccessDecoyFallback";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars && Object.keys(vars).length > 0 ? `${key} ${Object.values(vars).join(" ")}` : key,
    i18n: {},
    isLocaleReady: true,
  }),
}));

vi.mock("../hooks/useDecoyBooking", () => ({
  useDecoyBooking: vi.fn(),
}));

import { useDecoyBooking } from "../hooks/useDecoyBooking";

describe("BookingSuccessDecoyFallback", () => {
  it("returns null when no decoy data is found (hook redirects to 404)", () => {
    vi.mocked(useDecoyBooking).mockReturnValue(null);

    const { container } = render(<BookingSuccessDecoyFallback uid="missing-uid" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders BookingSuccessCard with decoy booking data including location row", () => {
    vi.mocked(useDecoyBooking).mockReturnValue({
      booking: {
        uid: "decoy-uid",
        title: "Quick Sync",
        startTime: "2026-05-10T14:00:00.000Z",
        endTime: "2026-05-10T14:30:00.000Z",
        booker: { name: "Alex Booker", email: "alex@example.com", timeZone: "UTC" },
        host: { name: "Sam Host", timeZone: "UTC" },
        location: "https://meet.daily.co/decoy-abc",
      },
      timestamp: Date.now(),
    });

    render(<BookingSuccessDecoyFallback uid="decoy-uid" />);

    expect(screen.getByText("Quick Sync")).toBeInTheDocument();
    expect(screen.getByText("Alex Booker")).toBeInTheDocument();
    expect(screen.getAllByText("Sam Host").length).toBeGreaterThan(0);
    expect(screen.getByTestId("booking-success-location")).toHaveAttribute("data-variant", "video");
  });
});
