import { BookingSuccessCard } from "~/bookings/components/BookingSuccessCard";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Design-review-only route. The production success page lives at
// /booking-successful/[uid] and renders this same <BookingSuccessCard> from
// DB-backed booking data — which requires a real seeded booking, so it can't
// render in the design canvas. This route mounts the identical card with
// static mock props so the design (incl. the personalized thank-you line) is
// reviewable live. Not linked from any production user flow.
export default function BookingSuccessPreview() {
  const start = new Date("2026-06-19T15:00:00.000Z");
  const end = new Date("2026-06-19T15:30:00.000Z");

  return (
    <BookingSuccessCard
      uid="preview"
      title="30 Minute Meeting"
      formattedDate="Friday, June 19, 2026"
      formattedTime="11:00 AM"
      endTime="11:30 AM"
      formattedTimeZone="America/New_York"
      hostName="Pietro Graceffa"
      hostEmail="pietro@cal.diy"
      hostAvatarUrl={null}
      attendeeName="Sample Attendee"
      attendeeEmail="attendee@example.com"
      location="https://zoom.us/j/123456789"
      startTime={start}
      rawEndTime={end}
      needsConfirmation={false}
      isCancelled={false}
    />
  );
}
