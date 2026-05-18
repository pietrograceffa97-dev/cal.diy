"use client";

/**
 * /booking/[uid] — Confirmation redesign (PRD: "Booking flow redesign — one product, three coherent screens").
 *
 * Reframes the page from terminal "Booked!" to "your meeting." Presentational redesign;
 * the dev story will wire it to the real booking record + derive state from `startTime`
 * vs. `Date.now()`.
 *
 * Three time-derived states (PRD §3):
 *   - just-booked   — minutes after confirmation; celebratory, emphasis on add-to-calendar
 *   - upcoming-24h  — meeting starts within 24h; emphasis on join link / prep
 *   - past          — meeting is history; primary action is "book again"
 */

import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Icon, type IconName } from "@calcom/ui/components/icon";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

type ConfirmationState = "just-booked" | "upcoming-24h" | "past";

const STATE_OPTIONS: { key: ConfirmationState; label: string }[] = [
  { key: "just-booked", label: "Just booked" },
  { key: "upcoming-24h", label: "Starts <24h" },
  { key: "past", label: "Past meeting" },
];

const STATE_COPY: Record<
  ConfirmationState,
  {
    eyebrow: string;
    headline: string;
    subhead: string;
    icon: IconName;
    iconBg: string;
    iconColor: string;
  }
> = {
  "just-booked": {
    eyebrow: "Confirmed",
    headline: "You're on the calendar",
    subhead: "We sent calendar invites to everyone. Add it to yours so you don't miss it.",
    icon: "circle-check",
    iconBg: "bg-cal-success",
    iconColor: "text-semantic-success",
  },
  "upcoming-24h": {
    eyebrow: "Starts in 4h 22m",
    headline: "Your meeting is coming up",
    subhead: "The join link is ready. Take a minute to prep — Pietro will too.",
    icon: "clock",
    iconBg: "bg-cal-info",
    iconColor: "text-semantic-info",
  },
  past: {
    eyebrow: "Past meeting",
    headline: "This meeting has wrapped",
    subhead: "Want to chat again? You can book another time with Pietro below.",
    icon: "calendar-check-2",
    iconBg: "bg-subtle",
    iconColor: "text-subtle",
  },
};

function StateSwitcher({
  active,
  onChange,
}: {
  active: ConfirmationState;
  onChange: (k: ConfirmationState) => void;
}) {
  return (
    <div className="mt-4 flex w-fit items-center gap-1 rounded-lg border border-subtle bg-default p-1 text-xs mx-auto">
      <span className="text-subtle px-2">Preview state</span>
      {STATE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          data-active={active === opt.key || undefined}
          className="text-default data-[active]:bg-subtle data-[active]:text-emphasis rounded-md px-2.5 py-1 font-medium">
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function BookingConfirmationRedesignedView({
  uid = "demo-uid",
}: {
  uid?: string;
}): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryState = searchParams?.get("state") as ConfirmationState | null;
  const [stateOverride, setStateOverride] = useState<ConfirmationState | null>(null);
  const activeState: ConfirmationState =
    stateOverride ??
    (queryState && STATE_OPTIONS.some((s) => s.key === queryState) ? queryState : "just-booked");

  const setState = (s: ConfirmationState) => {
    setStateOverride(s);
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    p.set("state", s);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  const copy = STATE_COPY[activeState];
  const isPast = activeState === "past";
  const isImminent = activeState === "upcoming-24h";

  return (
    <div
      className="bg-subtle min-h-screen"
      data-preview-state={activeState}
      data-testid="booking-confirmation-redesigned">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-16">
        <div className="bg-default border-subtle overflow-hidden rounded-2xl border shadow-elevation-low">
          {/* Hero header — the meeting block IS the hero, not a "Booked!" toast */}
          <header
            className="px-6 pb-6 pt-8 sm:px-10 sm:pt-10"
            aria-labelledby="confirmation-headline"
            data-state={activeState}>
            <div className="flex flex-col items-center text-center">
              <span
                aria-hidden
                className={`flex h-12 w-12 items-center justify-center rounded-full ${copy.iconBg}`}>
                <Icon name={copy.icon} className={`h-6 w-6 ${copy.iconColor}`} />
              </span>
              <p
                className={`mt-4 text-xs font-semibold uppercase tracking-wide ${
                  isImminent ? "text-semantic-info" : isPast ? "text-subtle" : "text-semantic-success"
                }`}>
                {copy.eyebrow}
              </p>
              <h1
                id="confirmation-headline"
                className="font-cal text-emphasis mt-2 text-2xl font-semibold sm:text-3xl">
                {copy.headline}
              </h1>
              <p className="text-default mt-2 max-w-md text-sm">{copy.subhead}</p>
            </div>
          </header>

          {/* Meeting details — definition-list pattern from DESIGN_SYSTEM.md */}
          <section
            aria-label="Meeting details"
            className="border-subtle border-t px-6 py-6 sm:px-10 sm:py-8">
            <h2 className="text-subtle text-xs font-semibold uppercase tracking-wide">Your meeting</h2>
            <h3 className="text-emphasis mt-2 text-lg font-semibold">Intro call</h3>

            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <dt className="text-subtle w-20 shrink-0 font-medium">Host</dt>
                <dd className="text-emphasis flex min-w-0 items-center gap-2">
                  <Avatar alt="Pietro Schirano" imageSrc="https://i.pravatar.cc/80?img=12" size="xs" />
                  <span className="truncate">Pietro Schirano</span>
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="text-subtle w-20 shrink-0 font-medium">When</dt>
                <dd className="text-emphasis min-w-0">
                  {isPast ? "Tuesday, October 28, 2025" : "Wednesday, November 13, 2025"}
                  <span className="text-default ml-1">· 10:00 – 10:30 AM PST</span>
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="text-subtle w-20 shrink-0 font-medium">Where</dt>
                <dd className="text-emphasis flex min-w-0 items-center gap-2">
                  <Icon name="video" className="text-default h-4 w-4 shrink-0" />
                  <span className="truncate">Cal Video</span>
                  {!isPast && (
                    <Badge variant={isImminent ? "success" : "gray"} size="sm">
                      {isImminent ? "Link ready" : "Link in invite"}
                    </Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="text-subtle w-20 shrink-0 font-medium">Booking ID</dt>
                <dd className="text-default min-w-0 truncate font-mono text-xs">{uid}</dd>
              </div>
            </dl>
          </section>

          {/* What's next — forward-looking actions, state-dependent emphasis */}
          <section
            aria-label="What's next"
            className="border-subtle border-t px-6 py-6 sm:px-10 sm:py-7"
            data-state={activeState}>
            <h2 className="text-subtle text-xs font-semibold uppercase tracking-wide">What's next</h2>

            {activeState === "just-booked" && (
              <>
                <Button className="mt-4 w-full" StartIcon="calendar">
                  Add to calendar
                </Button>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button color="secondary" StartIcon="calendar-days" size="sm">
                    Google
                  </Button>
                  <Button color="secondary" StartIcon="calendar-days" size="sm">
                    Outlook
                  </Button>
                  <Button color="secondary" StartIcon="download" size="sm">
                    .ics
                  </Button>
                </div>
              </>
            )}

            {activeState === "upcoming-24h" && (
              <>
                <Button className="mt-4 w-full" StartIcon="video">
                  Join Cal Video
                </Button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button color="secondary" StartIcon="calendar" size="sm">
                    Add to calendar
                  </Button>
                  <Button color="secondary" StartIcon="file-text" size="sm">
                    Open notes doc
                  </Button>
                </div>
              </>
            )}

            {activeState === "past" && (
              <>
                <Button className="mt-4 w-full" StartIcon="repeat" href="/pietro/30min">
                  Book another time with Pietro
                </Button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button color="secondary" StartIcon="user" size="sm" href="/pietro">
                    View host
                  </Button>
                  <Button color="secondary" StartIcon="message-circle" size="sm">
                    Leave feedback
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* Secondary destructive actions — present everywhere, de-emphasized */}
          {!isPast && (
            <div className="border-subtle bg-subtle/40 flex items-center justify-center gap-4 border-t px-6 py-3 text-xs sm:px-10">
              <button
                type="button"
                className={`text-subtle hover:text-emphasis font-medium underline-offset-2 hover:underline ${
                  isImminent ? "opacity-60" : ""
                }`}>
                Reschedule
              </button>
              <span className="text-subtle">·</span>
              <button
                type="button"
                className={`text-subtle hover:text-error font-medium underline-offset-2 hover:underline ${
                  isImminent ? "opacity-60" : ""
                }`}>
                Cancel
              </button>
            </div>
          )}
        </div>

        <StateSwitcher active={activeState} onChange={setState} />

        <p className="text-subtle mt-6 text-center text-xs">scheduled with cal.diy</p>
      </main>
    </div>
  );
}
