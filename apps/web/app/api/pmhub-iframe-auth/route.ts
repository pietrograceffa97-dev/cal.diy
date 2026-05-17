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
  // orgAwareUsername, impersonatedBy, inactiveAdminReason). The augmented
  // JWT interface in packages/types/next-auth.d.ts marks each optional
  // field as `?` (accepts undefined but not null), and the session
  // callback uses `token.x ?? null` patterns when reading them — so
  // omitting them entirely is safe. Downstream code that needs them
  // (org-scoped routes etc.) may need additional fields added here as
  // we discover them.
  const tokenPayload = {
    sub: String(user.id), // NextAuth standard
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    locale: user.locale ?? "en",
    role: user.role,
    orgAwareUsername: user.username,
    belongsToActiveTeam: false,
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
  //
  // HTTPS detection: prefer the request URL's scheme, fall back to
  // x-forwarded-proto (Vercel sets this on proxied requests), then to
  // NEXT_PUBLIC_WEBAPP_URL. The original code read `WEBAPP_URL` (no
  // NEXT_PUBLIC_ prefix), which isn't set in this scope at runtime —
  // meaning isHttps was always false, the cookie was named
  // `next-auth.session-token` (without `__Secure-` prefix) and
  // sameSite=lax — both wrong for the iframe / production case.
  // Production cal.diy reads `__Secure-next-auth.session-token` per
  // packages/lib/default-cookies.ts, so the older code's cookie was
  // never seen by downstream routes, and `/event-types` redirected
  // to /auth/login (X-Frame-Options: DENY) inside the iframe.
  // Cookie name MUST agree with what cal.diy's NextAuth READS in
  // packages/features/auth/lib/next-auth-options.ts:408 via
  // defaultCookies(useSecureCookies). Cal.diy's useSecureCookies is derived
  // from NEXT_PUBLIC_WEBAPP_URL.startsWith("https://") — which start.sh on
  // Railway overrides to http://localhost:3010/cal-diy-iframe (so cal.diy's
  // own self-fetches bypass PM Hub Basic Auth). The setter MUST mirror that
  // exact signal, NOT the request URL's scheme — otherwise on Railway the
  // x-forwarded-proto header makes isHttps=true and we set __Secure-…, but
  // cal.diy reads next-auth.session-token (no prefix). Mismatch → cookie
  // invisible → user appears logged out.
  const useSecureCookies = (process.env.NEXT_PUBLIC_WEBAPP_URL ?? "").startsWith(
    "https://",
  );
  const cookieStore = await cookies();
  const cookieName = `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`;
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: useSecureCookies ? "none" : "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });

  // 7. Redirect inside the iframe to the target route.
  //
  // Ported from cal.diy main (commit chain post-R7.7). The simpler
  // redirect(route) regressed: in Next 16 production with basePath set,
  // next/navigation redirect() does NOT prepend the basePath when called
  // from a route handler, so Location went out as /event-types and the
  // browser loaded PM Hub's 404 (chrome included) into the iframe
  // instead of cal.diy. Neither NextResponse.redirect (which resolves
  // against the internal 0.0.0.0:3010 origin) nor next/navigation
  // redirect work — main settled on a raw Response with a relative
  // Location header that the browser resolves against the document
  // origin (the public PM Hub URL).
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const bareRoute = route.startsWith('/') ? route : `/${route}`;
  const fullPath = `${basePath}${bareRoute}`;
  return new Response(null, {
    status: 307,
    headers: { Location: fullPath },
  });
}

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}
