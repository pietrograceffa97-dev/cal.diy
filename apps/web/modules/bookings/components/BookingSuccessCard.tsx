import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { CheckIcon } from "@coss/ui/icons";
import { BookingSuccessLocationRow } from "./BookingSuccessLocationRow";

export interface BookingSuccessCardInvitee {
  name?: string | null;
  email: string;
}

export interface BookingSuccessCardProps {
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
}

export function BookingSuccessCard({
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
}: BookingSuccessCardProps) {
  const { t } = useLocale();

  const hostDisplayName = hostName ?? t("host");

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div
          className="bg-default dark:bg-cal-muted border-booker border-booker-width overflow-hidden rounded-lg sm:rounded-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-success-headline">
          <header className="px-6 pb-6 pt-8 text-center sm:px-10 sm:pt-10">
            <div className="bg-cal-success mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <h1 id="booking-success-headline" className="text-emphasis mt-6 text-2xl font-semibold leading-7">
              {t("youre_booked")}
            </h1>
            <p className="text-default mt-3 text-sm leading-5">
              {attendeeEmail
                ? t("calendar_invite_and_confirmation_sent_to", { email: attendeeEmail })
                : t("emailed_you_and_any_other_attendees")}
            </p>
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
                      <p className="text-emphasis font-medium">{attendeeName}</p>
                      {attendeeEmail && <p className="text-subtle">{attendeeEmail}</p>}
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
                      {invitee.name && <p className="text-emphasis font-medium">{invitee.name}</p>}
                      <p className="text-subtle">{invitee.email}</p>
                    </div>
                  ))}
                </dd>
              </div>

              <BookingSuccessLocationRow location={location} />
            </dl>
          </section>

          {/* Action buttons (add-to-calendar, reschedule, cancel) — wired in follow-up stories */}
          <div data-testid="booking-success-actions-placeholder" />
        </div>
      </main>
    </div>
  );
}
