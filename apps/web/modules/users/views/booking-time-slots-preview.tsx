"use client";

/**
 * Design-review preview for the time-slot picker column of the booker.
 *
 * Why this file exists: the production /[user]/[type] page mounts the full
 * Booker, which requires deeply DB-coupled props (event-type metadata,
 * availability windows, schedules, user lookups). Rendering it for the
 * placeholder route shape that PM Hub iframes always 404s. This preview
 * stands in as a self-contained render of the *design surface the PRD
 * actually changes* — the empty-state inside `AvailableTimes` plus its
 * surrounding column chrome — using the same tokens, icon, copy, and CTA
 * shape the dev will ship. Real guests never hit `?variant=` so the
 * production booker path is untouched.
 *
 * The PRD calls for a unified outcome-state pattern (illustration + headline
 * + body copy + primary CTA) replacing the previous flat "all_booked_today"
 * message. The `empty` variant here is the canonical rendering of that
 * design; the `default` variant shows the populated state for side-by-side
 * comparison in design review.
 */

import { Button } from "@calcom/ui/components/button";
import { Avatar } from "@calcom/ui/components/avatar";
import { CalendarX2Icon, GlobeIcon, ClockIcon } from "@coss/ui/icons";

const MOCK_EVENT = {
  hostName: "Pietro Schirano",
  hostUsername: "pietro",
  hostAvatarUrl: null as string | null,
  title: "Product strategy sync",
  durationMinutes: 30,
  timezone: "Europe/Rome",
  selectedDateLabel: "Thursday, May 22",
} as const;

const MOCK_SLOTS = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "11:00 AM",
  "11:30 AM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "4:30 PM",
];

type Props = {
  variant: "default" | "empty";
};

export function BookingTimeSlotsPreview({ variant }: Props) {
  return (
    <main className="bg-muted flex min-h-screen items-start justify-center px-4 py-10">
      <div className="border-subtle bg-default w-full max-w-3xl overflow-hidden rounded-md border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr]">
          {/* Left column — event meta, mirrors Booker EventMeta */}
          <aside className="border-subtle border-b p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-3">
              <Avatar
                size="md"
                imageSrc={MOCK_EVENT.hostAvatarUrl}
                alt={MOCK_EVENT.hostName}
                accepted
              />
              <div className="flex flex-col">
                <span className="text-subtle text-sm">{MOCK_EVENT.hostName}</span>
              </div>
            </div>
            <h1 className="text-emphasis mt-4 text-2xl font-semibold leading-tight">
              {MOCK_EVENT.title}
            </h1>
            <dl className="mt-6 space-y-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="text-subtle h-4 w-4" aria-hidden />
                <dt className="sr-only">Duration</dt>
                <dd className="text-default text-sm">{MOCK_EVENT.durationMinutes} mins</dd>
              </div>
              <div className="flex items-center gap-2">
                <GlobeIcon className="text-subtle h-4 w-4" aria-hidden />
                <dt className="sr-only">Time zone</dt>
                <dd className="text-default text-sm">{MOCK_EVENT.timezone}</dd>
              </div>
            </dl>
            <p className="text-subtle mt-6 text-sm leading-5">
              Pick a time that works for you. We&apos;ll send a confirmation as soon as you&apos;re booked.
            </p>
          </aside>

          {/* Right column — date header + slot list. The empty variant is the
              design surface this project actually ships. */}
          <section className="p-6">
            <header className="mb-4 flex items-baseline justify-between">
              <h2 className="text-emphasis text-base font-semibold">
                {MOCK_EVENT.selectedDateLabel}
              </h2>
              <span className="text-subtle text-xs uppercase tracking-wide">12h</span>
            </header>

            {variant === "default" && (
              <div className="flex flex-col">
                {MOCK_SLOTS.map((time) => (
                  <button
                    key={time}
                    type="button"
                    className="border-default hover:border-brand-default text-emphasis bg-default mb-2 flex h-auto min-h-9 w-full grow flex-col justify-center rounded-md border px-3 py-2 text-sm font-medium transition">
                    {time}
                  </button>
                ))}
              </div>
            )}

            {variant === "empty" && <NoSlotsPreview />}
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * Mirror of the `NoSlotsAvailable` component in
 * apps/web/modules/bookings/components/AvailableTimes.tsx. Kept in sync by
 * hand — same tokens, same icon, same copy, same CTA shape. The CTA here is
 * non-functional (preview only); in production it clears `selectedDate` on
 * the Booker store, returning the user to the month view.
 */
function NoSlotsPreview() {
  return (
    <div
      data-preview-state="empty"
      className="bg-subtle border-subtle flex h-full flex-col items-center rounded-md border px-6 py-10 text-center dark:bg-transparent">
      <div
        aria-hidden
        className="bg-default border-subtle mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
        <CalendarX2Icon className="text-subtle h-5 w-5" />
      </div>
      <h3 className="text-emphasis text-base font-semibold leading-6">No times available</h3>
      <p className="text-subtle mt-2 max-w-[280px] text-sm leading-5">
        There are no openings on this day. Try a different date — the calendar shows the next
        available days in bold.
      </p>
      <Button color="secondary" size="sm" className="mt-5">
        Pick another date
      </Button>
    </div>
  );
}
