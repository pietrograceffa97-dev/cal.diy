import { loadTranslations } from "@calcom/i18n/server";
import { BookingStatus } from "@calcom/prisma/enums";
import { buildLegacyCtx } from "@lib/buildLegacyCtx";
import type { PageProps as _PageProps } from "app/_types";
import { _generateMetadata } from "app/_utils";
import { CustomI18nProvider } from "app/CustomI18nProvider";
import { withAppDirSsr } from "app/WithAppDirSsr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import OldPage from "~/bookings/views/bookings-single-view";
import {
  type PageProps as ClientPageProps,
  getServerSideProps,
} from "~/bookings/views/bookings-single-view.getServerSideProps";

const getData = withAppDirSsr<ClientPageProps>(getServerSideProps);

const NOINDEX_METADATA = {
  robots: {
    index: false,
    follow: false,
  },
} as const;

export const generateMetadata = async ({ params, searchParams }: _PageProps) => {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const uid = typeof resolvedParams.uid === "string" ? resolvedParams.uid : "";

  if (!uid || !hasActionMode(resolvedSearch)) {
    return NOINDEX_METADATA;
  }

  const { bookingInfo, eventType, recurringBookings } = await getData(
    buildLegacyCtx(await headers(), await cookies(), resolvedParams, resolvedSearch)
  );
  const needsConfirmation = bookingInfo.status === BookingStatus.PENDING && eventType.requiresConfirmation;

  const metadata = await _generateMetadata(
    (t) =>
      t(`booking_${needsConfirmation ? "submitted" : "confirmed"}${recurringBookings ? "_recurring" : ""}`),
    (t) =>
      t(`booking_${needsConfirmation ? "submitted" : "confirmed"}${recurringBookings ? "_recurring" : ""}`),
    false,
    process.env.NEXT_PUBLIC_WEBAPP_URL ?? "",
    `/booking/${uid}`
  );

  return {
    ...metadata,
    ...NOINDEX_METADATA,
  };
};

const BOOLEAN_ACTION_PARAMS = ["cancel", "reschedule", "changes"] as const;
// Non-empty string params that should keep the user on the legacy view:
// - seatReferenceUid: the legacy view surfaces the seat-specific attendee
// - redirect_status: Stripe 3DS off-site redirect lands here with a payment status
//   that the legacy view branches on (see bookings-single-view.tsx). Without this,
//   a failed/pending payment would redirect to "You're booked!".
const STRING_ACTION_PARAMS = ["seatReferenceUid", "redirect_status"] as const;

function hasActionMode(searchParams: Awaited<_PageProps["searchParams"]>): boolean {
  const hasBoolean = BOOLEAN_ACTION_PARAMS.some((key) => {
    const value = searchParams[key];
    return value === "true" || (Array.isArray(value) && value.includes("true"));
  });
  if (hasBoolean) return true;
  return STRING_ACTION_PARAMS.some((key) => {
    const value = searchParams[key];
    if (typeof value === "string") return value.length > 0;
    if (Array.isArray(value)) return value.some((v) => typeof v === "string" && v.length > 0);
    return false;
  });
}

function buildRedirectQueryString(searchParams: Awaited<_PageProps["searchParams"]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.append(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const ServerPage = async ({ params, searchParams }: _PageProps) => {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const uid = typeof resolvedParams.uid === "string" ? resolvedParams.uid : "";

  if (uid && !hasActionMode(resolvedSearch)) {
    redirect(`/booking-successful/${uid}${buildRedirectQueryString(resolvedSearch)}`);
  }

  const context = buildLegacyCtx(await headers(), await cookies(), resolvedParams, resolvedSearch);
  const props = await getData(context);

  const eventLocale = props.eventType?.interfaceLanguage;
  if (eventLocale) {
    const ns = "common";
    const translations = await loadTranslations(eventLocale, ns);
    return (
      <CustomI18nProvider translations={translations} locale={eventLocale} ns={ns}>
        <OldPage {...props} />
      </CustomI18nProvider>
    );
  }

  return <OldPage {...props} />;
};
export default ServerPage;
