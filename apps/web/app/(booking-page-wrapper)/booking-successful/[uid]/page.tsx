import dayjs from "@calcom/dayjs";
import getBookingInfo from "@calcom/features/bookings/lib/getBookingInfo";
import { loadTranslations } from "@calcom/i18n/server";
import { BookingStatus } from "@calcom/prisma/enums";
import type { PageProps as _PageProps } from "app/_types";
import { CustomI18nProvider } from "app/CustomI18nProvider";
import { BookingSuccessCard } from "~/bookings/components/BookingSuccessCard";
import { BookingSuccessDecoyFallback } from "~/bookings/components/BookingSuccessDecoyFallback";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Design-review variant scaffolding. PM Hub drives the post-booking
// confirmation through `?variant=confirmed|pending|cancelled` to show every
// state of the unified outcome pattern from the PRD. The default branch (no
// `?variant=` param) is unchanged from production — real guests never hit
// the variant path.
const VARIANT_KEYS = ["default", "confirmed", "pending", "cancelled"] as const;
type VariantKey = (typeof VARIANT_KEYS)[number];

function resolveVariant(raw: string | string[] | undefined): VariantKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (VARIANT_KEYS as readonly string[]).includes(value ?? "")
    ? (value as VariantKey)
    : "default";
}

// Mock fixture for the variant-driven design preview. Mirrors the shape that
// `getBookingInfo` returns just enough to drive `BookingSuccessCard`.
const MOCK_VARIANT_PROPS = {
  uid: "demo-booking",
  title: "Product strategy sync",
  hostName: "Pietro Schirano",
  hostEmail: "pietro@cal.diy",
  hostAvatarUrl: null,
  attendeeName: "Alex Rivera",
  attendeeEmail: "alex.rivera@example.com",
  location: "https://app.cal.com/video/demo-booking",
  // Render against a fixed weekday so the design review screenshots are
  // deterministic regardless of when the iframe loads.
  formattedDate: "Thursday, May 22, 2026",
  formattedTime: "2:00 PM",
  endTime: "2:30 PM",
  formattedTimeZone: "Europe/Rome",
  // ISO equivalents of formattedDate/Time for add-to-calendar metadata.
  startTimeIso: "2026-05-22T12:00:00.000Z",
  endTimeIso: "2026-05-22T12:30:00.000Z",
};

export default async function BookingSuccessful({ params, searchParams }: _PageProps) {
  const resolved = await params;
  const resolvedSearch = await searchParams;
  const variant = resolveVariant(resolvedSearch.variant);

  // Variant-mocked design preview branch. Renders against a fixed fixture so
  // every state of the unified outcome pattern is reachable from PM Hub's
  // drafting view without touching real backend data.
  if (variant !== "default") {
    const needsConfirmation = variant === "pending";
    const isCancelled = variant === "cancelled";
    return (
      <BookingSuccessCard
        uid={MOCK_VARIANT_PROPS.uid}
        title={MOCK_VARIANT_PROPS.title}
        formattedDate={MOCK_VARIANT_PROPS.formattedDate}
        formattedTime={MOCK_VARIANT_PROPS.formattedTime}
        endTime={MOCK_VARIANT_PROPS.endTime}
        formattedTimeZone={MOCK_VARIANT_PROPS.formattedTimeZone}
        hostName={MOCK_VARIANT_PROPS.hostName}
        hostEmail={MOCK_VARIANT_PROPS.hostEmail}
        hostAvatarUrl={MOCK_VARIANT_PROPS.hostAvatarUrl}
        attendeeName={MOCK_VARIANT_PROPS.attendeeName}
        attendeeEmail={MOCK_VARIANT_PROPS.attendeeEmail}
        additionalInvitees={[]}
        location={MOCK_VARIANT_PROPS.location}
        startTime={MOCK_VARIANT_PROPS.startTimeIso}
        rawEndTime={MOCK_VARIANT_PROPS.endTimeIso}
        needsConfirmation={needsConfirmation}
        confirmationApproverName={MOCK_VARIANT_PROPS.hostName}
        isCancelled={isCancelled}
        cancellationReason={isCancelled ? "Schedule conflict — sorry about that." : null}
        cancelledBy={isCancelled ? MOCK_VARIANT_PROPS.hostEmail : null}
        rebookHref="/pietro/30min"
      />
    );
  }

  const uid = typeof resolved.uid === "string" ? resolved.uid : "";

  if (!uid) {
    return <BookingSuccessDecoyFallback uid="" />;
  }

  const { bookingInfo } = await getBookingInfo(uid);

  if (!bookingInfo) {
    return <BookingSuccessDecoyFallback uid={uid} />;
  }

  const startTime = bookingInfo.startTime ? dayjs(bookingInfo.startTime) : null;
  const endTime = bookingInfo.endTime ? dayjs(bookingInfo.endTime) : null;
  const timeZone = bookingInfo.attendees[0]?.timeZone || bookingInfo.user?.timeZone || dayjs.tz.guess();

  const formattedDate = startTime ? startTime.tz(timeZone).format("dddd, MMMM D, YYYY") : "";
  const formattedTime = startTime ? startTime.tz(timeZone).format("h:mm A") : "";
  const formattedEndTime = endTime ? endTime.tz(timeZone).format("h:mm A") : "";

  const attendee = bookingInfo.attendees[0] ?? null;
  const additionalInvitees = bookingInfo.attendees.slice(1).map((a) => ({
    name: a.name,
    email: a.email,
  }));

  const hideOrganizerEmail = bookingInfo.eventType?.hideOrganizerEmail ?? false;
  const hostEmail = hideOrganizerEmail
    ? null
    : (bookingInfo.userPrimaryEmail ?? bookingInfo.user?.email ?? null);

  const startTimeIso = startTime ? startTime.toISOString() : new Date().toISOString();
  const endTimeIso = endTime ? endTime.toISOString() : startTimeIso;

  const needsConfirmation =
    bookingInfo.status === BookingStatus.PENDING && Boolean(bookingInfo.eventType?.requiresConfirmation);

  const isCancelled =
    bookingInfo.status === BookingStatus.CANCELLED || bookingInfo.status === BookingStatus.REJECTED;

  // Mirror the legacy success view: rejection reason and cancellation reason
  // share the same UI slot — REJECTED bookings store the reason on
  // `rejectionReason`, CANCELLED bookings on `cancellationReason`.
  const cancellationReason = bookingInfo.cancellationReason || bookingInfo.rejectionReason || null;
  // Suppress cancelledBy when the event hides the organizer email. The legacy
  // view also exempted the host from this guard (`!isHost`), but that requires
  // session context this server component doesn't have — fall back to the safe
  // side and hide for everyone, since leaking the organizer email when the
  // event is configured to hide it is the worse failure mode.
  const cancelledBy = hideOrganizerEmail ? null : (bookingInfo.cancelledBy ?? null);

  // Mirror the legacy success view's `profile.name` source: prefer the team
  // name for team/collective events and fall back to the assigned host so the
  // awaiting-confirmation subtitle reads naturally on round-robin bookings
  // that haven't picked a host yet.
  const confirmationApproverName = bookingInfo.eventType?.team?.name ?? bookingInfo.user?.name ?? null;

  // Cancelled-state "Book again" CTA. The PRD calls this out as the single
  // primary action a guest landing on a cancelled link needs — link back to
  // the event-type page so they can rebook in one click. We assemble it from
  // the booking's event-type slug + the host's profile slug; fall back to the
  // home page if either piece is missing (degrades to a navigable link
  // rather than a dead button).
  const eventTypeSlug = bookingInfo.eventType?.slug ?? null;
  const profileSlug = bookingInfo.user?.username ?? null;
  const rebookHref =
    eventTypeSlug && profileSlug ? `/${profileSlug}/${eventTypeSlug}` : "/";

  const card = (
    <BookingSuccessCard
      uid={uid}
      title={bookingInfo.title || "Booking"}
      formattedDate={formattedDate}
      formattedTime={formattedTime}
      endTime={formattedEndTime}
      formattedTimeZone={timeZone}
      hostName={bookingInfo.user?.name ?? null}
      hostEmail={hostEmail}
      hostAvatarUrl={bookingInfo.user?.avatarUrl ?? null}
      attendeeName={attendee?.name ?? null}
      attendeeEmail={attendee?.email ?? null}
      additionalInvitees={additionalInvitees}
      location={bookingInfo.location || null}
      startTime={startTimeIso}
      rawEndTime={endTimeIso}
      needsConfirmation={needsConfirmation}
      confirmationApproverName={confirmationApproverName}
      isCancelled={isCancelled}
      cancellationReason={cancellationReason}
      cancelledBy={cancelledBy}
      rebookHref={rebookHref}
    />
  );

  const eventLocale = bookingInfo.eventType?.interfaceLanguage;
  if (eventLocale) {
    const ns = "common";
    const translations = await loadTranslations(eventLocale, ns);
    return (
      <CustomI18nProvider translations={translations} locale={eventLocale} ns={ns}>
        {card}
      </CustomI18nProvider>
    );
  }

  return card;
}
