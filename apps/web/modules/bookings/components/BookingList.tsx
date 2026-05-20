"use client";

import type { Table as ReactTable } from "@tanstack/react-table";

import { DataTableWrapper } from "~/data-table/components";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import {
  BookingsEmptyIllustration,
  EmptyScreen,
  IllustratedEmptyScreen,
} from "@calcom/ui/components/empty-screen";

import SkeletonLoader from "@components/booking/SkeletonLoader";

import type { RowData, BookingListingStatus } from "../types";

const descriptionByStatus: Record<BookingListingStatus, string> = {
  upcoming: "upcoming_bookings",
  recurring: "recurring_bookings",
  past: "past_bookings",
  cancelled: "cancelled_bookings",
  unconfirmed: "unconfirmed_bookings",
};

type BookingListViewProps = {
  status: BookingListingStatus;
  table: ReactTable<RowData>;
  isPending: boolean;
  totalRowCount?: number;
  ErrorView?: React.ReactNode;
  hasError?: boolean;
};

/**
 * Empty view for `/bookings/upcoming` — illustration-led, matches the
 * Event types empty state for host-dashboard visual coherence.
 *
 * CTA picks "Share your booking link" as the default next action for a
 * returning host with no upcoming bookings. If the host has zero event
 * types, the better CTA would be "Create event type" — that branching
 * needs the eventTypes count threaded through `BookingsList`. Left as a
 * follow-up tied to the PRD's open question on branching; copy + link
 * here defaults to the share-link path and is documented inline.
 *
 * The other status tabs (Past / Cancelled / Unconfirmed / Recurring)
 * are explicitly out of scope per the PRD and keep the existing
 * icon-based `EmptyScreen` pattern.
 */
function UpcomingEmptyView() {
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-center pt-2 xl:pt-0">
      <IllustratedEmptyScreen
        data-testid="upcoming-bookings-empty-state"
        illustration={<BookingsEmptyIllustration />}
        headline={t("no_upcoming_bookings_headline", {
          defaultValue: "No upcoming bookings",
        })}
        description={t("no_upcoming_bookings_description", {
          defaultValue:
            "When someone books one of your event types, it shows up here. Share your link to get your first booking.",
        })}
        buttonRaw={
          <Button data-testid="share-booking-link" href="/event-types">
            {t("share_your_booking_link", { defaultValue: "Share your booking link" })}
          </Button>
        }
      />
    </div>
  );
}

export function BookingList({
  status,
  table,
  isPending,
  totalRowCount,
  ErrorView,
  hasError,
}: BookingListViewProps) {
  const { t } = useLocale();

  return (
    <DataTableWrapper
      className="mb-6"
      table={table}
      testId={`${status}-bookings`}
      bodyTestId="bookings"
      headerClassName="hidden"
      isPending={isPending}
      totalRowCount={totalRowCount}
      variant="compact"
      paginationMode="standard"
      separatorClassName="py-4 pl-6 text-xs uppercase leading-4"
      LoaderView={<SkeletonLoader />}
      EmptyView={
        status === "upcoming" ? (
          <UpcomingEmptyView />
        ) : (
          <div className="flex items-center justify-center pt-2 xl:pt-0">
            <EmptyScreen
              Icon="calendar"
              headline={t("no_status_bookings_yet", { status: t(status).toLowerCase() })}
              description={t("no_status_bookings_yet_description", {
                status: t(status).toLowerCase(),
                description: t(descriptionByStatus[status]),
              })}
            />
          </div>
        )
      }
      ErrorView={ErrorView}
      hasError={hasError}
    />
  );
}
