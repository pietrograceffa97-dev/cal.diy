import { useMemo } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@calcom/ui/components/dropdown";

import {
  buildSuccessCardCalendarLinks,
  type SuccessCardCalendarInput,
} from "../lib/buildSuccessCardCalendarLinks";

export interface BookingSuccessAddToCalendarProps extends SuccessCardCalendarInput {
  /** File slug used when downloading the .ics; defaults to a sanitized form of the booking title. */
  icsFileName?: string;
}

function sanitizeFileName(value: string): string {
  return (
    value
      .replace(/[^a-z0-9-_\s]/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "booking"
  );
}

export function BookingSuccessAddToCalendar(props: BookingSuccessAddToCalendarProps) {
  const { t } = useLocale();
  const { icsFileName, ...calendarInput } = props;

  const links = useMemo(() => buildSuccessCardCalendarLinks(calendarInput), [calendarInput]);
  const downloadName = `${sanitizeFileName(icsFileName ?? calendarInput.title)}.ics`;

  return (
    <Dropdown>
      <DropdownMenuTrigger asChild>
        <Button
          color="primary"
          EndIcon="chevron-down"
          data-testid="booking-success-add-to-calendar-trigger"
          aria-label={t("add_to_calendar")}>
          {t("add_to_calendar")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        data-testid="booking-success-add-to-calendar-menu"
        aria-label={t("add_to_calendar")}>
        <DropdownMenuItem>
          <DropdownItem
            href={links.googleCalendar}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="booking-success-add-to-calendar-google">
            {t("google_calendar")}
          </DropdownItem>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <DropdownItem
            href={links.outlook}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="booking-success-add-to-calendar-outlook">
            {t("outlook")}
          </DropdownItem>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <DropdownItem
            href={links.ics || undefined}
            download={downloadName}
            disabled={!links.ics}
            data-testid="booking-success-add-to-calendar-apple">
            {t("apple_calendar")}
          </DropdownItem>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <DropdownItem
            href={links.ics || undefined}
            download={downloadName}
            disabled={!links.ics}
            data-testid="booking-success-add-to-calendar-ics">
            {t("download_ics")}
          </DropdownItem>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </Dropdown>
  );
}
