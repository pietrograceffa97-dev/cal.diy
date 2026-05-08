import dayjs from "@calcom/dayjs";
import getBookingInfo from "@calcom/features/bookings/lib/getBookingInfo";
import { loadTranslations } from "@calcom/i18n/server";
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

  const card = (
    <BookingSuccessCard
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
