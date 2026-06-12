"use client";

/**
 * Thin client for the PM Hub assistant backend.
 *
 * Every call goes to cal.diy's OWN same-origin proxy (`/api/pmhub-assistant/*`),
 * which session-gates the request, HMAC-signs it, and forwards to PM Hub's
 * `/api/embed/*`. The browser never sees the PM Hub secret and there's no CORS.
 */

const PROXY_BASE = "/api/pmhub-assistant";

export type PmhubResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export async function pmhubGet<T = unknown>(
  path: string,
  query?: Record<string, string | null | undefined>
): Promise<PmhubResult<T>> {
  const qs = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  return request<T>(`${PROXY_BASE}/${path}${qs}`, { method: "GET" });
}

export async function pmhubPost<T = unknown>(path: string, body: unknown): Promise<PmhubResult<T>> {
  return request<T>(`${PROXY_BASE}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

async function request<T>(url: string, init: RequestInit): Promise<PmhubResult<T>> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      const err = (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      return { ok: false, error: err, status: res.status };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", status: 0 };
  }
}
