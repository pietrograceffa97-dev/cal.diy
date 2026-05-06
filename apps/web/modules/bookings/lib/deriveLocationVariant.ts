import { guessEventLocationType } from "@calcom/app-store/locations";

export type LocationVariant =
  | { kind: "video"; url: string }
  | { kind: "video-pending" }
  | { kind: "address"; venue: string | null; address: string }
  | { kind: "phone"; number: string }
  | { kind: "tbd" };

const URL_RE = /^https?:\/\//i;

// Permissive E.164-ish match: optional leading +, then 6+ digits (allowing
// spaces, dashes, parentheses). We don't need libphonenumber-level rigor here —
// the value already passed validation upstream when the booking was created.
const PHONE_RE = /^\+?[\d][\d\s\-()]{4,}$/;

const SOMEWHERE_ELSE_TYPE = "somewhereElse";
const INTEGRATIONS_PREFIX = "integrations:";

function splitVenueAndAddress(raw: string): { venue: string | null; address: string } {
  const lines = raw
    .split(/\r?\n|,\s*/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return { venue: null, address: raw.trim() };
  }

  const [venue, ...rest] = lines;
  return { venue, address: rest.join(", ") };
}

export function deriveLocationVariant(location: string | null | undefined): LocationVariant {
  if (!location) {
    return { kind: "tbd" };
  }

  const trimmed = location.trim();
  if (!trimmed) {
    return { kind: "tbd" };
  }

  if (URL_RE.test(trimmed)) {
    return { kind: "video", url: trimmed };
  }

  // Any `integrations:*` value is a conferencing app whose URL hasn't been
  // generated yet. We resolve this before phone/provider lookup because the
  // app-store metadata may not be available in all environments (e.g. unit
  // tests) and `integrations:*` is unambiguously video-pending.
  if (trimmed.startsWith(INTEGRATIONS_PREFIX)) {
    return { kind: "video-pending" };
  }

  // Plain phone number value (decoy bookings persist the booker-provided phone
  // here for `attendeePhoneNumber` location types).
  if (PHONE_RE.test(trimmed)) {
    return { kind: "phone", number: trimmed };
  }

  const provider = guessEventLocationType(trimmed);

  // App-store providers (`provider.default !== true`) are all conferencing
  // apps and were already handled by the `integrations:` short-circuit above.
  // Anything reaching here that's a known default type uses its `category` to
  // pick the right variant.
  if (provider && provider.default) {
    if (provider.type === SOMEWHERE_ELSE_TYPE) {
      return { kind: "tbd" };
    }
    if (provider.category === "conferencing") {
      return { kind: "video-pending" };
    }
    if (provider.category === "phone") {
      // Phone-typed location with no concrete number stored — treat as TBD
      // instead of producing a misleading directional copy without a number.
      return { kind: "tbd" };
    }
    if (provider.category === "in_person_category") {
      const split = splitVenueAndAddress(trimmed);
      return split.address.length > 0 ? { kind: "address", ...split } : { kind: "tbd" };
    }
  }

  // Fallback: free-form text we can't classify is treated as a physical
  // address — that's the most common shape for non-typed location strings.
  return { kind: "address", ...splitVenueAndAddress(trimmed) };
}
