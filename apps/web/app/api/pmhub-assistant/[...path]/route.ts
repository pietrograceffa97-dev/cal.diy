import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";

import { buildLegacyRequest } from "@lib/buildLegacyCtx";

export const dynamic = "force-dynamic";

/**
 * Same-origin proxy for the PM Hub assistant backend.
 *
 * The native widget (client) calls `/api/pmhub-assistant/<path>` on cal.diy's
 * own origin. This route:
 *   1. Requires an authenticated cal.diy session (only real users drive it).
 *   2. HMAC-signs the request with the shared `PMHUB_EMBED_SECRET`.
 *   3. Forwards it to PM Hub's `/api/embed/<path>`, returning the response.
 *
 * The secret never reaches the browser and there's no CORS (client → cal.diy is
 * same-origin; cal.diy → PM Hub is server-to-server). Mirrors the auth contract
 * in PM Hub's `lib/embed/embed-auth.ts`.
 */

const PMHUB_BASE = (
  process.env.PMHUB_PUBLIC_URL ?? "https://pm-agentic-hub-production.up.railway.app"
).replace(/\/+$/, "");
const SECRET = process.env.PMHUB_EMBED_SECRET;
const SIG_HEADER = "x-pmhub-embed-sig";
const EXP_HEADER = "x-pmhub-embed-exp";
const USER_HEADER = "x-pmhub-embed-user";

async function proxy(req: NextRequest, method: "GET" | "POST", pathParts: string[]): Promise<NextResponse> {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // Only forward to /api/embed/<safe> — strip any path traversal.
  const safe = pathParts.filter((p) => p && p !== "." && p !== "..").join("/");
  if (!safe) return NextResponse.json({ ok: false, error: "missing path" }, { status: 400 });
  const pathname = `/api/embed/${safe}`;
  const search = req.nextUrl.search;

  const rawBody = method === "POST" ? await req.text() : "";

  const headersOut: Record<string, string> = {
    "content-type": "application/json",
    [USER_HEADER]: session.user.email ?? String(session.user.id),
  };
  if (SECRET) {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const payload = `${method}|${pathname}|${exp}|${bodyHash}`;
    headersOut[SIG_HEADER] = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    headersOut[EXP_HEADER] = String(exp);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${PMHUB_BASE}${pathname}${search}`, {
      method,
      headers: headersOut,
      body: method === "POST" ? rawBody : undefined,
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "upstream unreachable" },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, "GET", path ?? []);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, "POST", path ?? []);
}
