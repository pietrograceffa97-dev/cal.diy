import { useLocale } from "@calcom/lib/hooks/useLocale";
import { CopyIcon } from "@coss/ui/icons";
import { useCallback, useState } from "react";
import { deriveLocationVariant } from "../lib/deriveLocationVariant";

const COPIED_RESET_MS = 1500;

export interface BookingSuccessLocationRowProps {
  location: string | null;
}

export function BookingSuccessLocationRow({ location }: BookingSuccessLocationRowProps) {
  const { t } = useLocale();
  const variant = deriveLocationVariant(location);

  const label = t("where");

  return (
    <div
      className="flex items-start gap-3"
      data-testid="booking-success-location"
      data-variant={variant.kind}>
      <dt className="text-subtle w-20 shrink-0 font-medium">{label}</dt>
      <dd className="text-default min-w-0 flex-1">
        <LocationVariantContent variant={variant} t={t} />
      </dd>
    </div>
  );
}

type Variant = ReturnType<typeof deriveLocationVariant>;

function LocationVariantContent({ variant, t }: { variant: Variant; t: ReturnType<typeof useLocale>["t"] }) {
  switch (variant.kind) {
    case "video":
      return <VideoVariant url={variant.url} t={t} />;
    case "video-pending":
      return (
        <p data-testid="booking-success-location-video-pending">
          {t("booking_location_video_pending_message")}
        </p>
      );
    case "address":
      return (
        <div className="flex flex-col gap-1" data-testid="booking-success-location-address">
          {variant.venue && <p className="text-emphasis font-medium">{variant.venue}</p>}
          <p className="whitespace-pre-line">{variant.address}</p>
        </div>
      );
    case "phone":
      return (
        <p data-testid="booking-success-location-phone">
          {t("booking_location_phone_directional", { phone: variant.number })}
        </p>
      );
    case "tbd":
      return <p data-testid="booking-success-location-tbd">{t("booking_location_tbd_message")}</p>;
  }
}

function VideoVariant({ url, t }: { url: string; t: ReturnType<typeof useLocale>["t"] }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    });
  }, [url]);

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="booking-success-location-video">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emphasis font-medium underline-offset-2 hover:underline"
        data-testid="booking-success-location-join">
        {t("join_meeting")}
      </a>
      <span className="text-subtle">·</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-default min-w-0 break-all"
        data-testid="booking-success-location-url">
        {url}
      </a>
      <button
        type="button"
        onClick={onCopy}
        aria-label={t("copy_to_clipboard")}
        className="text-subtle hover:text-emphasis inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
        data-testid="booking-success-location-copy">
        {copied ? (
          <span data-testid="booking-success-location-copied">{t("copied")}</span>
        ) : (
          <>
            <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("copy")}</span>
          </>
        )}
      </button>
    </div>
  );
}
