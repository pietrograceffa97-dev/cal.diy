import type { SVGProps } from "react";

/**
 * Friendly, restrained illustrations for the host-dashboard empty states.
 *
 * Visual language:
 *  - Soft rounded geometry, generous whitespace, no shadows.
 *  - Surface fills via `bg-subtle` / `bg-emphasis` tokens (passed in as
 *    Tailwind classes on layered groups) so the illustration adapts to
 *    light / dark theme without us re-coloring.
 *  - One brand accent per illustration (`bg-brand-default` family) to draw
 *    the eye toward the actionable element (a link node, a marked day).
 *
 * Illustrations are decorative; the parent renders the heading + copy.
 * The svg root carries `aria-hidden` and `focusable={false}` so screen
 * readers skip it.
 */

type IllustrationProps = SVGProps<SVGSVGElement>;

/**
 * Event-types empty state — a link / chain motif. Suggests "the link you
 * share with people to book you" without literally drawing a URL.
 */
export function EventTypesEmptyIllustration({ className, ...rest }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 140"
      role="img"
      aria-hidden="true"
      focusable={false}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      {/* Soft circular backdrop — uses cal.diy's subtle surface so it tints with theme. */}
      <circle cx="100" cy="74" r="58" className="fill-subtle" />

      {/* Floating card — represents an event type tile. */}
      <g>
        <rect
          x="36"
          y="50"
          width="92"
          height="46"
          rx="8"
          className="fill-default stroke-subtle"
          strokeWidth="1"
        />
        <rect x="48" y="62" width="44" height="6" rx="3" className="fill-emphasis opacity-70" />
        <rect x="48" y="76" width="64" height="4" rx="2" className="fill-emphasis opacity-30" />
        <rect x="48" y="84" width="36" height="4" rx="2" className="fill-emphasis opacity-30" />
      </g>

      {/* Second card peeking from behind — depth without literal stacking. */}
      <g opacity="0.55">
        <rect
          x="92"
          y="38"
          width="72"
          height="40"
          rx="8"
          className="fill-default stroke-subtle"
          strokeWidth="1"
        />
        <rect x="104" y="50" width="36" height="5" rx="2.5" className="fill-emphasis opacity-60" />
        <rect x="104" y="62" width="48" height="3" rx="1.5" className="fill-emphasis opacity-25" />
      </g>

      {/* Brand-accent link node — the single eye-catching element. */}
      <g>
        <circle cx="146" cy="92" r="14" className="fill-brand-default" />
        <path
          d="M141 92h10M146 87v10"
          stroke="currentColor"
          className="text-inverted"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * Bookings empty state — calendar motif with a marked day. Suggests
 * "a future booking will land on the calendar" without showing a full grid.
 */
export function BookingsEmptyIllustration({ className, ...rest }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 140"
      role="img"
      aria-hidden="true"
      focusable={false}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}>
      {/* Soft circular backdrop. */}
      <circle cx="100" cy="74" r="58" className="fill-subtle" />

      {/* Calendar body. */}
      <g>
        <rect
          x="56"
          y="40"
          width="88"
          height="72"
          rx="10"
          className="fill-default stroke-subtle"
          strokeWidth="1"
        />
        {/* Header strip */}
        <rect x="56" y="40" width="88" height="14" className="fill-emphasis opacity-10" />
        {/* Binding rings */}
        <rect x="72" y="34" width="4" height="14" rx="2" className="fill-emphasis opacity-60" />
        <rect x="124" y="34" width="4" height="14" rx="2" className="fill-emphasis opacity-60" />
        {/* Grid dots — restrained, not a literal calendar grid. */}
        {[0, 1, 2, 3].map((col) =>
          [0, 1, 2].map((row) => (
            <circle
              key={`${col}-${row}`}
              cx={70 + col * 20}
              cy={68 + row * 14}
              r="2"
              className="fill-emphasis opacity-25"
            />
          ))
        )}
      </g>

      {/* Brand-accent marked day — the single eye-catching element. */}
      <g>
        <circle cx="110" cy="82" r="9" className="fill-brand-default" />
      </g>
    </svg>
  );
}
