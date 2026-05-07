"use client";

import dayjs from "@calcom/dayjs";
import { useDecoyBooking } from "~/bookings/hooks/useDecoyBooking";
import { BookingSuccessCard } from "./BookingSuccessCard";

export function BookingSuccessDecoyFallback({ uid }: { uid: string }) {
  const bookingData = useDecoyBooking(uid);

  if (!bookingData) {
    return null;
  }

  const { booking } = bookingData;

  const startTime = booking.startTime ? dayjs(booking.startTime) : null;
  const endTime = booking.endTime ? dayjs(booking.endTime) : null;
  const timeZone = booking.booker?.timeZone || booking.host?.timeZone || dayjs.tz.guess();

  const formattedDate = startTime ? startTime.tz(timeZone).format("dddd, MMMM D, YYYY") : "";
  const formattedTime = startTime ? startTime.tz(timeZone).format("h:mm A") : "";
  const formattedEndTime = endTime ? endTime.tz(timeZone).format("h:mm A") : "";

  return (
    <BookingSuccessCard
      title={booking.title || "Booking"}
      formattedDate={formattedDate}
      formattedTime={formattedTime}
      endTime={formattedEndTime}
      formattedTimeZone={timeZone}
      hostName={booking.host?.name || null}
      hostEmail={null}
      attendeeName={booking.booker?.name || null}
      attendeeEmail={booking.booker?.email || null}
      location={booking.location || null}
      startTime={booking.startTime}
      rawEndTime={booking.endTime}
    />
  );
}
