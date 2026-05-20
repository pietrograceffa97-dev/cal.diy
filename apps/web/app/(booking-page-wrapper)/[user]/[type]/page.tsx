import { WEBAPP_URL } from "@calcom/lib/constants";
import { loadTranslations } from "@calcom/i18n/server";
import { buildLegacyCtx, decodeParams } from "@lib/buildLegacyCtx";
import { getServerSideProps } from "@server/lib/[user]/[type]/getServerSideProps";
import type { PageProps } from "app/_types";
import { generateMeetingMetadata } from "app/_utils";
import { CustomI18nProvider } from "app/CustomI18nProvider";
import { withAppDirSsr } from "app/WithAppDirSsr";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type React from "react";
import type { PageProps as LegacyPageProps } from "~/users/views/users-type-public-view";
import LegacyPage from "~/users/views/users-type-public-view";
import { BookingTimeSlotsPreview } from "~/users/views/booking-time-slots-preview";

const getData: (ctx: ReturnType<typeof buildLegacyCtx>) => Promise<LegacyPageProps> =
  withAppDirSsr<LegacyPageProps>(getServerSideProps);

// Design-review variant scaffolding. The cal.diy production page renders a
// deeply DB-coupled Booker with availability, schedules, and event metadata
// pulled from getServerSideProps — placeholder bracket values 404 there.
// To keep both PM Hub iframes alive without forking the production path, we
// short-circuit on `?variant=` and render a self-contained preview of the
// time-slot picker column that mirrors the component the dev will actually
// ship, using the same tokens / icon / copy as `AvailableTimes`. Real guests
// never hit `?variant=` so this branch is invisible in production.
const VARIANT_KEYS = ["default", "empty"] as const;
type VariantKey = (typeof VARIANT_KEYS)[number];

function resolveVariant(raw: string | string[] | undefined): VariantKey | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return (VARIANT_KEYS as readonly string[]).includes(value) ? (value as VariantKey) : null;
}

const ServerPage = async ({ params, searchParams }: PageProps): Promise<JSX.Element> => {
  const resolvedSearch = await searchParams;
  const variant = resolveVariant(resolvedSearch.variant);

  if (variant) {
    return <BookingTimeSlotsPreview variant={variant} />;
  }

  const legacyCtx = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(legacyCtx);

  const locale = props.eventData?.interfaceLanguage;
  if (locale) {
    const ns = "common";
    const translations = await loadTranslations(locale, ns);
    return (
      <CustomI18nProvider translations={translations} locale={locale} ns={ns}>
        <LegacyPage {...props} />
      </CustomI18nProvider>
    );
  }

  return <LegacyPage {...props} />;
};

export const generateMetadata = async ({ params, searchParams }: PageProps): Promise<Metadata> => {
  const resolvedSearch = await searchParams;
  // Skip the data fetch on variant-preview requests; PM Hub iframes don't
  // need real meeting metadata and the lookup would 404 against placeholder
  // params anyway.
  if (resolveVariant(resolvedSearch.variant)) {
    return {
      robots: { follow: false, index: false },
    };
  }

  const legacyCtx = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(legacyCtx);

  const { booking, isSEOIndexable = true, eventData, isBrandingHidden } = props;
  const rescheduleUid = booking?.uid;
  const profileName = eventData?.profile?.name ?? "";
  const title = eventData?.title ?? "";
  const meeting = {
    title,
    profile: { name: profileName, image: eventData?.profile.image },
    users:
      eventData?.subsetOfUsers.map((user) => ({
        name: `${user.name}`,
        username: `${user.username}`,
      })) || [],
  };
  const decodedParams = decodeParams(await params);
  const metadata = await generateMeetingMetadata(
    meeting,
    (t) => `${rescheduleUid && !!booking ? t("reschedule") : ""} ${title} | ${profileName}`,
    (t) => `${rescheduleUid ? t("reschedule") : ""} ${title}`,
    isBrandingHidden,
    WEBAPP_URL,
    `/${decodedParams.user}/${decodedParams.type}`
  );

  return {
    ...metadata,
    robots: {
      follow: !(eventData?.hidden || !isSEOIndexable),
      index: !(eventData?.hidden || !isSEOIndexable),
    },
  };
};

export default ServerPage;
