"use client";

import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { CheckIcon } from "@coss/ui/icons";
import { BookingSuccessActions } from "./BookingSuccessActions";
import { BookingSuccessAddToCalendar } from "./BookingSuccessAddToCalendar";
import { BookingSuccessLocationRow } from "./BookingSuccessLocationRow";

export interface BookingSuccessCardInvitee {
  name?: string | null;
  email: string;
}

export interface BookingSuccessCardProps {
  uid: string;
  title: string;
  formattedDate: string;
  formattedTime: string;
  endTime: string;
  formattedTimeZone: string;
  hostName: string | null;
  hostEmail: string | null;
  hostAvatarUrl?: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  additionalInvitees?: BookingSuccessCardInvitee[];
  location: string | null;
  startTime: Date | string;
  rawEndTime: Date | string;
  needsConfirmation?: boolean;
  // Name shown in the awaiting-confirmation subtitle. Mirrors the legacy view's
  // `profile.name` (team name for team/collective events, host name otherwise).
  // Falls back to `hostName` if not provided.
  confirmationApproverName?: string | null;
}

export function BookingSuccessCard({
  uid,
  title,
  formattedDate,
  formattedTime,
  endTime,
  formattedTimeZone,
  hostName,
  hostEmail,
  hostAvatarUrl,
  attendeeName,
  attendeeEmail,
  additionalInvitees,
  location,
  startTime,
  rawEndTime,
  needsConfirmation = false,
  confirmationApproverName,
}: BookingSuccessCardProps) {
  const { t } = useLocale();

  const hostDisplayName = hostName ?? t("host");
  const approverName = confirmationApproverName ?? hostName;

  const headline = needsConfirmation ? t("booking_submitted") : t("youre_booked");
  const subtitle = (() => {
    if (needsConfirmation) {
      return approverName
        ? t("user_needs_to_confirm_or_reject_booking", { user: approverName })
        : t("needs_to_be_confirmed_or_rejected");
    }
    return attendeeEmail
      ? t("calendar_invite_and_confirmation_sent_to", { email: attendeeEmail })
      : t("emailed_you_and_any_other_attendees");
  })();

  const calendarAttendees = [
    attendeeEmail ? { name: attendeeName, email: attendeeEmail } : null,
    ...(additionalInvitees?.map((invitee) => ({ name: invitee.name ?? null, email: invitee.email })) ?? []),
  ].filter((a): a is { name: string | null; email: string } => a !== null);
  const calendarOrganizer = hostEmail ? { name: hostName, email: hostEmail } : undefined;

  return (
    <div className="min-h-screen" data-testid="success-page">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-16" aria-labelledby="booking-success-headline">
        <div className="bg-default dark:bg-cal-muted border-booker border-booker-width overflow-hidden rounded-lg sm:rounded-xl">
          <header
            className="px-6 pb-6 pt-6 text-center sm:px-10 sm:pt-10"
            data-needs-confirmation={needsConfirmation || undefined}>

            <div className="bg-cal-success mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <CheckIcon className="h-5 w-5 text-green-700 dark:text-green-400" aria-hidden="true" />
            </div>
            <h1 id="booking-success-headline" className="text-emphasis mt-6 text-2xl font-semibold leading-7">
              {headline}
            </h1>
            <p className="text-default mt-3 text-sm leading-5">{subtitle}</p>
          </header>

          <section
            className="border-subtle border-t px-6 py-6 sm:px-10 sm:py-8"
            aria-label={t("meeting_details")}>
            <h2 className="text-emphasis text-lg font-semibold leading-6">{title}</h2>

            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <dt className="text-subtle w-20 shrink-0 font-medium">{t("host")}</dt>
                <dd className="text-default flex min-w-0 items-center gap-2">
                  <Avatar
                    size="sm"
                    imageSrc={hostAvatarUrl || getPlaceholderAvatar(null, hostDisplayName)}
                    alt={hostDisplayName}
                  />
                  <span className="truncate">{hostDisplayName}</span>
                </dd>
              </div>

              {formattedDate && (
                <div className="flex items-start gap-3">
                  <dt className="text-subtle w-20 shrink-0 font-medium">{t("date")}</dt>
                  <dd className="text-default min-w-0">{formattedDate}</dd>
                </div>
              )}

              {formattedTime && (
                <div className="flex items-start gap-3">
                  <dt className="text-subtle w-20 shrink-0 font-medium">{t("time")}</dt>
                  <dd className="text-default min-w-0">
                    {formattedTime}
                    {endTime && ` – ${endTime}`}
                    {formattedTimeZone && <span className="text-subtle"> ({formattedTimeZone})</span>}
                  </dd>
                </div>
              )}

              <div className="flex items-start gap-3">
                <dt className="text-subtle w-20 shrink-0 font-medium">{t("attendees")}</dt>
                <dd className="text-default flex min-w-0 flex-col gap-3">
                  {attendeeName && (
                    <div>
                      <p className="text-emphasis font-medium" data-testid={`attendee-name-${attendeeName}`}>
                        {attendeeName}
                      </p>
                      {attendeeEmail && (
                        <p className="text-subtle" data-testid={`attendee-email-${attendeeEmail}`}>
                          {attendeeEmail}
                        </p>
                      )}
                    </div>
                  )}
                  {hostName && (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-emphasis font-medium">{hostName}</p>
                        <Badge variant="blue">{t("host")}</Badge>
                      </div>
                      {hostEmail && <p className="text-subtle">{hostEmail}</p>}
                    </div>
                  )}
                  {additionalInvitees?.map((invitee) => (
                    <div key={invitee.email}>
                      {invitee.name && (
                        <p
                          className="text-emphasis font-medium"
                          data-testid={`attendee-name-${invitee.name}`}>
                          {invitee.name}
                        </p>
                      )}
                      <p className="text-subtle" data-testid={`attendee-email-${invitee.email}`}>
                        {invitee.email}
                      </p>
                    </div>
                  ))}
                </dd>
              </div>

              <BookingSuccessLocationRow location={location} />
            </dl>
          </section>

          <div
            className="border-subtle flex flex-wrap items-center gap-3 border-t px-6 py-6 sm:px-10"
            data-testid="booking-success-actions">
            <BookingSuccessAddToCalendar
              title={title}
              startTime={startTime}
              endTime={rawEndTime}
              location={location}
              attendees={calendarAttendees}
              organizer={calendarOrganizer}
            />
            {uid && (
              <BookingSuccessActions
                uid={uid}
                title={title}
                formattedDate={formattedDate}
                formattedTime={formattedTime}
                formattedEndTime={endTime}
                formattedTimeZone={formattedTimeZone}
                rescheduledBy={attendeeEmail}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
