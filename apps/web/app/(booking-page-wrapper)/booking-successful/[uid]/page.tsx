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

export default async function BookingSuccessful({ params }: _PageProps) {
  const resolved = await params;
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
