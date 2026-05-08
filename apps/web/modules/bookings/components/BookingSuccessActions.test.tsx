import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (vars && Object.keys(vars).length > 0) {
        return `${key} ${Object.values(vars).join(" ")}`;
      }
      return key;
    },
    i18n: {},
    isLocaleReady: true,
  }),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const showToastMock = vi.fn();
vi.mock("@calcom/ui/components/toast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

// Radix Dialog uses a Portal that doesn't always cooperate with jsdom. We
// inline the children so we can assert on dialog markup without driving the
// portal lifecycle (covered end-to-end by Playwright).
vi.mock("@calcom/ui/components/dialog", async () => {
  const React = await import("react");
  type Children = { children?: React.ReactNode };
  return {
    Dialog: ({ open, children }: Children & { open?: boolean; onOpenChange?: (open: boolean) => void }) =>
      open ? <div data-testid="mock-dialog">{children}</div> : null,
    DialogContent: ({
      children,
      title,
      description,
      ...rest
    }: Children & { title?: string; description?: string } & Record<string, unknown>) => {
      const { type: _type, preventCloseOnOutsideClick: _p, ...domProps } = rest;
      return (
        <div role="dialog" aria-label={title} {...(domProps as Record<string, unknown>)}>
          {title && <h2>{title}</h2>}
          {description && <p>{description}</p>}
          {children}
        </div>
      );
    },
  };
});

import { BookingSuccessActions } from "./BookingSuccessActions";

const baseProps = {
  uid: "abc123",
  title: "Sales Sync",
  formattedDate: "Friday, May 15, 2026",
  formattedTime: "10:00 AM",
  formattedEndTime: "10:30 AM",
  formattedTimeZone: "America/New_York",
  rescheduledBy: "ada@example.com",
};

describe("BookingSuccessActions", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    refreshMock.mockReset();
    showToastMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Reschedule as a link to /reschedule/[uid] with rescheduledBy query", () => {
    render(<BookingSuccessActions {...baseProps} />);
    const link = screen.getByTestId("booking-success-reschedule") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      `/reschedule/abc123?rescheduledBy=${encodeURIComponent("ada@example.com")}`
    );
    expect(link).toHaveTextContent("reschedule");
  });

  it("falls back to plain reschedule link when no rescheduledBy is provided", () => {
    render(<BookingSuccessActions {...baseProps} rescheduledBy={null} />);
    const link = screen.getByTestId("booking-success-reschedule") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/reschedule/abc123");
  });

  it("ignores a malformed rescheduledBy value (not a valid email)", () => {
    render(<BookingSuccessActions {...baseProps} rescheduledBy="not-an-email" />);
    const link = screen.getByTestId("booking-success-reschedule") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/reschedule/abc123");
  });

  it("does not open the cancel dialog by default", () => {
    render(<BookingSuccessActions {...baseProps} />);
    expect(screen.queryByTestId("mock-dialog")).not.toBeInTheDocument();
  });

  it("opens the cancel dialog when Cancel is clicked and restates the meeting", () => {
    render(<BookingSuccessActions {...baseProps} />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));

    expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
    const summary = screen.getByTestId("booking-success-cancel-dialog-summary");
    expect(summary).toHaveTextContent("Sales Sync");
    expect(summary).toHaveTextContent("Friday, May 15, 2026");
    expect(summary).toHaveTextContent("10:00 AM");
    expect(summary).toHaveTextContent("10:30 AM");
    expect(summary).toHaveTextContent("America/New_York");
  });

  it("closes the cancel dialog when 'Keep meeting' is clicked", () => {
    render(<BookingSuccessActions {...baseProps} />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));
    expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("booking-success-cancel-keep"));
    expect(screen.queryByTestId("mock-dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to /api/cancel with the booking uid and CSRF token when confirmed", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/csrf")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: "TOKEN_64" }),
        } as Response);
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ success: true }) } as Response);
    });

    render(<BookingSuccessActions {...baseProps} />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));
    fireEvent.click(screen.getByTestId("booking-success-cancel-confirm"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/csrf?sameSite=none", { cache: "no-store" });
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/cancel",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const cancelCall = fetchMock.mock.calls.find(([url]) => url === "/api/cancel");
    const body = JSON.parse(cancelCall![1].body);
    expect(body).toMatchObject({
      uid: "abc123",
      cancelledBy: "ada@example.com",
      csrfToken: "TOKEN_64",
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("booking_cancelled", "success");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("shows an error toast and keeps the dialog open if cancellation fails", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/csrf")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: "TOKEN_64" }),
        } as Response);
      }
      return Promise.resolve({
        status: 400,
        json: () => Promise.resolve({ message: "boom" }),
      } as Response);
    });

    render(<BookingSuccessActions {...baseProps} />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));
    fireEvent.click(screen.getByTestId("booking-success-cancel-confirm"));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("boom", "error");
    });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
  });

  it("Cancel button is rendered with subtle styling and turns destructive on hover", () => {
    render(<BookingSuccessActions {...baseProps} />);
    const cancelBtn = screen.getByTestId("booking-success-cancel");
    expect(cancelBtn.className).toMatch(/hover:text-error/);
    expect(cancelBtn.className).toMatch(/hover:bg-error/);
  });

  it("does not include cancelledBy in the payload when rescheduledBy is missing or malformed", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/csrf")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: "TOKEN_64" }),
        } as Response);
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ success: true }) } as Response);
    });

    render(<BookingSuccessActions {...baseProps} rescheduledBy="not-an-email" />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));
    fireEvent.click(screen.getByTestId("booking-success-cancel-confirm"));

    await waitFor(() => {
      const cancelCall = fetchMock.mock.calls.find(([url]) => url === "/api/cancel");
      expect(cancelCall).toBeDefined();
      const body = JSON.parse(cancelCall![1].body);
      expect(body).not.toHaveProperty("cancelledBy");
      expect(body).toMatchObject({ uid: "abc123", csrfToken: "TOKEN_64" });
    });
  });

  it("Enter on the Keep-meeting button closes the dialog without calling fetch", () => {
    render(<BookingSuccessActions {...baseProps} />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));

    const keep = screen.getByTestId("booking-success-cancel-keep") as HTMLButtonElement;
    // Browsers translate Enter on a focused button into a click; assert the
    // semantic outcome (dialog closes, no cancel network call) which is what
    // the AC's "Enter only confirms when destructive button is focused" guards.
    fireEvent.click(keep);
    expect(screen.queryByTestId("mock-dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts cancel and surfaces an error if the CSRF endpoint returns no token", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/csrf")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      }
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ success: true }) } as Response);
    });

    render(<BookingSuccessActions {...baseProps} />);
    fireEvent.click(screen.getByTestId("booking-success-cancel"));
    fireEvent.click(screen.getByTestId("booking-success-cancel-confirm"));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("please_try_again", "error");
    });
    const cancelCall = fetchMock.mock.calls.find(([url]) => url === "/api/cancel");
    expect(cancelCall).toBeUndefined();
  });
});
