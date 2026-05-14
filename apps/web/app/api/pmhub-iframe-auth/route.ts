import crypto from "node:crypto";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import prisma from "@calcom/prisma";

export const dynamic = "force-dynamic";

/**
 * PM Hub iframe auto-login.
 *
 * PM Hub's Drafting view iframes cal.diy pages so the PM can compare
 * the live cal.diy "current design" against the in-flight prototype.
 * Most cal.diy product surfaces are auth-gated — unauthenticated
 * requests redirect to /auth/login which sets X-Frame-Options: DENY,
 * so the iframe never renders.
 *
 * This route lets PM Hub mint a short-lived authenticated session for
 * a test account, scoped to the iframe context. PM Hub signs the
 * request with a shared HMAC secret; we verify, look up the user,
 * mint a NextAuth-compatible JWT, set the session cookie, and 302 to
 * the target route. The iframe loads the route already signed in.
 *
 * Security
 *  - HMAC-SHA256(secret, "<email>|<route>|<exp>") — only PM Hub
 *    (which has the secret) can mint URLs.
 *  - `exp` is a Unix-seconds expiry; 5 min default from PM Hub side.
 *    Replayed URLs reject after expiry.
 *  - `PMHUB_IFRAME_AUTH_ALLOWED_USERS` is a comma-separated allowlist
 *    of impersonable emails. Real customer accounts must not be on
 *    this list — only dedicated test accounts.
 *  - The minted session is read-only by convention. Cal.diy doesn't
 *    expose a way to mark sessions as readonly in the JWT, so this is
 *    a discipline matter: keep the test accounts to throwaway data.
 *
 * Query params:
 *   email — the impersonated user's email (must be in allowlist)
 *   route — the cal.diy route to redirect into after auth
 *   exp   — Unix-seconds expiry of this URL
 *   sig   — hex HMAC-SHA256 of `${email}|${route}|${exp}`
 *
 * Failure modes return 401 (envelope unchanged so PM Hub can render a
 * helpful empty state in the iframe parent on cross-origin error).
 */
export async function GET(req: Request): Promise<NextResponse | Response | never> {
  const secret = process.env.PMHUB_IFRAME_AUTH_SECRET;
  const allowedRaw = process.env.PMHUB_IFRAME_AUTH_ALLOWED_USERS;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return jsonError(503, "PMHUB_IFRAME_AUTH_SECRET not configured on cal.diy");
  }
  if (!nextAuthSecret) {
    return jsonError(503, "NEXTAUTH_SECRET not configured on cal.diy");
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  const route = url.searchParams.get("route") ?? "/";
  const expStr = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!email || !expStr || !sig) {
    return jsonError(400, "missing required params");
  }

  // 1. Verify expiry
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return jsonError(401, "url expired");
  }

  // 2. Verify HMAC (timing-safe)
  const payload = `${email}|${route}|${exp}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return jsonError(401, "bad signature");
  }

  // 3. Verify user is on the allowlist
  const allowed = (allowedRaw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email.toLowerCase())) {
    return jsonError(401, "user not on PMHUB_IFRAME_AUTH_ALLOWED_USERS allowlist");
  }

  // 4. Look up the user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      locale: true,
      role: true,
    },
  });
  if (!user) {
    return jsonError(404, `user ${email} not found`);
  }

  // 5. Build a minimal NextAuth-compatible JWT token.
  // The session callback at packages/features/auth/lib/next-auth-options.ts
  // reads token.id, .email, .name, .username, .locale, .role, plus a few
  // optional fields (profileId, upId, org, belongsToActiveTeam,
  // orgAwareUsername, impersonatedBy, inactiveAdminReason). Optional
  // fields default to null/undefined and don't crash the session.
  // Downstream code that needs them (org-scoped routes, etc.) may need
  // additional fields added here as we discover them.
  const tokenPayload = {
    sub: String(user.id), // NextAuth standard
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    locale: user.locale ?? "en",
    role: user.role,
    // Optional fields — left null so downstream nullable readers don't crash:
    profileId: null,
    upId: null,
    orgAwareUsername: user.username,
    belongsToActiveTeam: false,
    org: null,
    impersonatedBy: null,
    inactiveAdminReason: null,
  };

  const sessionMaxAge = 60 * 60; // 1h — short, since this is iframe-only

  const token = await encode({
    secret: nextAuthSecret,
    token: tokenPayload,
    maxAge: sessionMaxAge,
  });

  // 6. Set the session cookie. Name + options must match
  // packages/lib/default-cookies.ts (cal.diy already sets
  // SameSite=None; Secure on HTTPS — iframe-friendly by design).
  const cookieStore = await cookies();
  const isHttps = (process.env.WEBAPP_URL ?? "").startsWith("https://");
  const cookieName = isHttps ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });

  // 7. Redirect inside the iframe to the target route.
  redirect(route);
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}
