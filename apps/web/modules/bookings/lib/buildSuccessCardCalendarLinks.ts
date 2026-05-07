import dayjs from "@calcom/dayjs";
import {
  buildGoogleCalendarLink,
  buildICalLink,
  buildMicrosoftOfficeLink,
  buildMicrosoftOutlookLink,
  type ICalAttendee,
} from "@calcom/features/bookings/lib/getCalendarLinks";

export interface SuccessCardCalendarInput {
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  description?: string | null;
  location?: string | null;
  attendees?: ICalAttendee[];
  organizer?: ICalAttendee;
}

export interface SuccessCardCalendarLinks {
  googleCalendar: string;
  outlook: string;
  microsoftOffice: string;
  ics: string;
}

export function buildSuccessCardCalendarLinks({
  title,
  startTime,
  endTime,
  description = null,
  location = null,
  attendees,
  organizer,
}: SuccessCardCalendarInput): SuccessCardCalendarLinks {
  const start = dayjs(startTime);
  const end = dayjs(endTime);
  const eventDescription = description ?? null;
  const bookingLocation = location ?? null;

  const googleCalendar = buildGoogleCalendarLink({
    startTime: start,
    endTime: end,
    eventName: title,
    eventDescription,
    bookingLocation,
    recurringEvent: null,
  });

  const microsoftOffice = buildMicrosoftOfficeLink({
    startTime: start,
    endTime: end,
    eventName: title,
    eventDescription,
    bookingLocation,
  });

  const outlook = buildMicrosoftOutlookLink({
    startTime: start,
    endTime: end,
    eventName: title,
    eventDescription,
    bookingLocation,
  });

  let ics = "";
  try {
    ics = buildICalLink({
      startTime: start,
      endTime: end,
      title,
      description: eventDescription,
      location: bookingLocation,
      attendees,
      organizer,
    });
  } catch (error) {
    // ICS generation is best-effort: if the underlying library rejects the
    // input we still want the rest of the menu to work.
    console.error("Failed to generate ICS for booking success card", error);
  }

  return { googleCalendar, outlook, microsoftOffice, ics };
}
