import type { ReactNode } from "react";
import React from "react";

import classNames from "@calcom/ui/classNames";

import { Button } from "../button";

/**
 * Illustration-led empty state for the host dashboard.
 *
 * Sibling of `EmptyScreen` — kept as a peer (not a refactor of the existing
 * component) so the icon-based callsites elsewhere in the app keep working.
 * Both pages in scope of the "unified empty states" PRD (`/event-types` and
 * `/bookings/upcoming`) consume THIS component for visual coherence.
 *
 * Contract:
 *  - One required illustration slot — decorative, `aria-hidden`.
 *  - Real `<h2>` heading. Single sentence of supporting copy.
 *  - Single primary action. No secondary buttons. A `learnMoreHref` slot
 *    renders an optional small text-link below the primary CTA.
 *  - Sits inside the normal page layout (no full-bleed). The page chrome
 *    above (header, breadcrumbs, CTA) is rendered by the route, not here.
 *  - Centered in its container; illustration scales down at narrow widths.
 */
export function IllustratedEmptyScreen({
  illustration,
  headline,
  description,
  buttonText,
  buttonOnClick,
  buttonHref,
  buttonRaw,
  learnMoreText,
  learnMoreHref,
  className,
  "data-testid": dataTestId,
}: {
  /** Illustration React node — typically one of the components in `./illustrations`. Decorative. */
  illustration: React.ReactElement;
  headline: string | React.ReactElement;
  description?: string | React.ReactElement;
  buttonText?: string;
  buttonOnClick?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  buttonHref?: string;
  /** Escape hatch — pass a fully-rendered button (e.g. wrapped in a Dialog trigger). */
  buttonRaw?: ReactNode;
  learnMoreText?: string;
  learnMoreHref?: string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      data-testid={dataTestId ?? "illustrated-empty-screen"}
      className={classNames(
        // Page-layout-aware: stays inside the content area, not full-bleed.
        // Generous vertical breathing room so the illustration has room to land.
        "flex w-full select-none flex-col items-center justify-center",
        "px-6 py-12 sm:py-16 lg:py-20",
        className
      )}>
      {/* Illustration block. Responsive — scales down on narrow widths,
          never wider than the copy block. aria-hidden via the svg root. */}
      <div className="mb-6 flex w-full max-w-[260px] justify-center sm:mb-8 sm:max-w-[320px]">
        {React.cloneElement(illustration, {
          className: classNames("h-auto w-full", illustration.props?.className),
        })}
      </div>

      {/* Copy + action block — narrow column, centered. */}
      <div className="flex max-w-[440px] flex-col items-center text-center">
        <h2
          className={classNames(
            "font-cal text-emphasis text-xl normal-nums",
            !description && "mb-6"
          )}>
          {headline}
        </h2>
        {description && (
          <p className="text-default mt-2 mb-6 text-sm font-normal leading-6">{description}</p>
        )}
        {buttonRaw ? (
          buttonRaw
        ) : buttonText ? (
          <Button
            data-testid="illustrated-empty-screen-cta"
            href={buttonHref}
            onClick={buttonOnClick ? (e) => buttonOnClick(e) : undefined}>
            {buttonText}
          </Button>
        ) : null}
        {learnMoreText && learnMoreHref && (
          <a
            href={learnMoreHref}
            target="_blank"
            rel="noreferrer"
            className="text-subtle hover:text-emphasis mt-4 text-sm underline-offset-2 hover:underline">
            {learnMoreText}
          </a>
        )}
      </div>
    </div>
  );
}
