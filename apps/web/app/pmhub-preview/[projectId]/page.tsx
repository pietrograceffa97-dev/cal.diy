import type { Metadata } from "next";

/**
 * Cal.diy → PM Hub preview embed.
 *
 * This route renders PM Hub's prototype (`/prototype/<projectId>` on
 * Railway) inside an iframe, framed by minimal cal.diy chrome — so a
 * Product Manager iterating in PM Hub can click "Open in cal.diy" and
 * see what their prototype looks like as a real cal.diy URL.
 *
 * URL shape:
 *   /pmhub-preview/<projectId>?route=/pro/30min
 *
 * The optional `route` query param is used for display only — it tells
 * the PM which cal.diy route their prototype targets. The actual page
 * content is the iframed PM Hub prototype.
 *
 * Configuration:
 *   - `PMHUB_PUBLIC_URL` (env) — public URL where PM Hub is reachable.
 *     Defaults to the Railway production URL. PM Hub's middleware
 *     whitelists `/prototype/:path*` from Basic Auth so the iframe
 *     loads without credentials.
 *
 * Not indexed (robots noindex) — internal preview, never a real user
 * destination.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "PM Hub preview · cal.diy",
};

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ route?: string }>;
};

export default async function PmHubPreviewPage({
  params,
  searchParams,
}: Props) {
  const { projectId } = await params;
  const { route } = await searchParams;

  const pmhubUrl =
    process.env.PMHUB_PUBLIC_URL ??
    "https://pm-agentic-hub-production.up.railway.app";

  const prototypeSrc = `${pmhubUrl.replace(/\/+$/, "")}/prototype/${encodeURIComponent(
    projectId,
  )}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        margin: 0,
        background: "white",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#0a0a0a",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 20px",
          borderBottom: "1px solid #e5e5e5",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 18,
              height: 18,
              borderRadius: 4,
              background: "#0a0a0a",
            }}
          />
          <span style={{ fontWeight: 600 }}>cal.diy</span>
          <span style={{ color: "#9ca3af" }}>·</span>
          <span style={{ color: "#6b7280" }}>PM Hub preview</span>
          {route ? (
            <>
              <span style={{ color: "#9ca3af" }}>·</span>
              <code
                style={{
                  background: "#f3f4f6",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  fontSize: 12,
                }}
              >
                {route}
              </code>
            </>
          ) : null}
          <span
            style={{
              marginLeft: 8,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              fontSize: 11,
              color: "#9ca3af",
            }}
          >
            {projectId}
          </span>
        </div>
        <a
          href={pmhubUrl}
          rel="noopener noreferrer"
          style={{
            color: "#0a0a0a",
            textDecoration: "none",
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            border: "1px solid #e5e5e5",
            borderRadius: 6,
          }}
        >
          ← Back to PM Hub
        </a>
      </header>
      <iframe
        title={`PM Hub prototype · ${projectId}`}
        src={prototypeSrc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{
          flex: 1,
          width: "100%",
          border: 0,
          background: "white",
        }}
      />
    </div>
  );
}
