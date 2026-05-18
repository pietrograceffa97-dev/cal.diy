/**
 * /booking/[uid] — Confirmation route.
 *
 * This file currently renders the **redesigned** presentational confirmation view for the
 * booking-flow redesign prototype (see PRD §3). The legacy `bookings-single-view` and its
 * action-mode plumbing (cancel/reschedule/etc.) and the `/booking-successful/[uid]` redirect
 * are intentionally bypassed in the prototype so reviewers can hit `/booking/<anything>`
 * and see the redesign across all three time-derived states via the `?state=` query.
 *
 * The dev story will:
 *   - Restore the action-mode + redirect plumbing.
 *   - Wire the redesigned view to the real booking record + derive `state` from `startTime`.
 */

import type { PageProps } from "app/_types";

import BookingConfirmationRedesignedView from "~/bookings/views/booking-confirmation-redesigned-view";

const NOINDEX_METADATA = {
  robots: {
    index: false,
    follow: false,
  },
} as const;

export const generateMetadata = async () => NOINDEX_METADATA;

const ServerPage = async ({ params }: PageProps): Promise<JSX.Element> => {
  const resolvedParams = await params;
  const uid = typeof resolvedParams.uid === "string" ? resolvedParams.uid : "demo-uid";

  return <BookingConfirmationRedesignedView uid={uid} />;
};

export default ServerPage;
