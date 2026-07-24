import crypto from "node:crypto";

import { NextResponse } from "next/server";

import prisma from "@calcom/prisma";

/**
 * Signed, read-first endpoint that resolves the PM-Hub (Parallel) Flow Map's
 * dynamic-route sample params at runtime, so screens like /event-types/[type]
 * and /availability/[schedule] (whose ids are auto-increment and NOT stable
 * across re-seeds) can be screenshotted against staging.
 *
 * Sibling of /api/pmhub-iframe-auth — SAME HMAC scheme + SAME secret
 * (PMHUB_IFRAME_AUTH_SECRET) + SAME allowlist (PMHUB_IFRAME_AUTH_ALLOWED_USERS).
 * Parallel signs `${email}|pmhub-sample-params|${exp}` and calls this; we verify
 * the signature + expiry + allowlist, then look up the allowlisted user's ids.
 *
 * Read-first: the eventType / schedule / booking values are pure reads. The one
 * write is an idempotent UPSERT of a durable "sample" HashedLink for /d/[link]
 * (never created by the seed) — best-effort and wrapped so a failure just omits
 * hashedLink from the response (that screen degrades to needs-precondition).
 *
 * Returns { ok:true, eventTypeId, eventTypeSlug, scheduleId, bookingUid,
 * hashedLink: { link, slug } | null }. No session is minted (unlike iframe-auth)
 * — this only returns ids for an allowlisted account's own sample data.
 */
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.PMHUB_IFRAME_AUTH_SECRET;
  if (!secret) return jsonError(503, "PMHUB_IFRAME_AUTH_SECRET not configured");

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  const route = url.searchParams.get("route") ?? "/";
  const expStr = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!email || !expStr || !sig) return jsonError(400, "missing required params");

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return jsonError(401, "url expired");
  }

  // HMAC-SHA256 hex over `${email}|${route}|${exp}` — identical scheme + secret
  // to pmhub-iframe-auth. Timing-safe compare, length-guarded.
  const payload = `${email}|${route}|${exp}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return jsonError(401, "bad signature");
  }

  const allowedRaw = process.env.PMHUB_IFRAME_AUTH_ALLOWED_USERS;
  const allowed = (allowedRaw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email.toLowerCase())) {
    return jsonError(401, "user not on PMHUB_IFRAME_AUTH_ALLOWED_USERS allowlist");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return jsonError(404, "user not found");

  // Prefer the "30min" event type (the seed's richest anchor: it has both a
  // stable booking uid and a well-known slug); fall back to the user's first.
  const eventType =
    (await prisma.eventType.findFirst({
      where: { userId: user.id, slug: "30min" },
      select: { id: true, slug: true },
    })) ??
    (await prisma.eventType.findFirst({
      where: { userId: user.id },
      orderBy: { position: "desc" },
      select: { id: true, slug: true },
    }));

  const schedule = await prisma.schedule.findFirst({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  const booking = await prisma.booking.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { uid: true },
  });

  // /d/[link]/[slug] needs a HashedLink, which the seed never creates. Upsert a
  // durable one (idempotent by a fixed link string) on the chosen event type.
  // `validate()` (the VIEW path) never increments usageCount, so the default
  // maxUsageCount=1 survives repeated captures. Best-effort — omit on failure.
  let hashedLink: { link: string; slug: string } | null = null;
  if (eventType) {
    try {
      const link = `pmhub-sample-${eventType.id}`;
      await prisma.hashedLink.upsert({
        where: { link },
        create: { link, eventTypeId: eventType.id },
        update: {},
      });
      hashedLink = { link, slug: eventType.slug };
    } catch {
      hashedLink = null;
    }
  }

  return NextResponse.json({
    ok: true,
    eventTypeId: eventType?.id ?? null,
    eventTypeSlug: eventType?.slug ?? null,
    scheduleId: schedule?.id ?? null,
    bookingUid: booking?.uid ?? null,
    hashedLink,
  });
}
