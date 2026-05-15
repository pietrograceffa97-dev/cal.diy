"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * PM Hub preview overlay.
 *
 * Wraps the authenticated main-nav layout's children. When the URL
 * carries `?pmhub_project_id=<id>`, replaces the page's content slot
 * with an iframe to PM Hub's `/prototype/<id>` route. Cal.diy's app
 * shell (sidebar, nav, header, active-route highlight) keeps
 * rendering normally — the active nav item is whichever cal.diy
 * route the PM is currently on (e.g. `/event-types`), driven by
 * cal.diy's real routing.
 *
 * Net effect: clicking "Open in cal.diy" from PM Hub's Drafting
 * view lands the PM on cal.diy's real `/event-types` page (or
 * whatever target_cal_diy_route the prototype declared), with the
 * PM Hub prototype rendered in the content slot. They see the
 * proposed design INSIDE cal.diy's actual chrome instead of as a
 * standalone iframe wrapper.
 *
 * Security:
 *   - This overlay is only reachable from authenticated cal.diy
 *     routes (the layout is under `(use-page-wrapper)`, which
 *     redirects to /auth/login when the session is missing).
 *   - Project id is validated against a strict regex so a crafted
 *     URL can't iframe arbitrary content from PM Hub. The iframe
 *     `src` is always `${pmhubBaseUrl}/prototype/<validated-id>`.
 *   - `pmhubBaseUrl` is read server-side from `PMHUB_PUBLIC_URL` and
 *     passed as a prop — no NEXT_PUBLIC_ leak required.
 *   - Sandbox attribute restricts the iframe to scripts +
 *     same-origin (so its own React + esbuild bundles can run);
 *     forms are allowed because some prototypes include interactive
 *     forms.
 */
const PROJECT_ID_REGEX = /^[a-zA-Z0-9-]+$/;

export function PmhubPreviewOverlay({
  pmhubBaseUrl,
  children,
}: {
  pmhubBaseUrl: string;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const projectId = params.get("pmhub_project_id");
  const [exited, setExited] = useState(false);

  if (!projectId) return <>{children}</>;
  if (exited) return <>{children}</>;
  if (!PROJECT_ID_REGEX.test(projectId)) return <>{children}</>;
  if (!pmhubBaseUrl) return <>{children}</>;

  const cleanBase = /^https?:\/\//.test(pmhubBaseUrl)
    ? pmhubBaseUrl
    : `https://${pmhubBaseUrl}`;
  const iframeSrc = `${cleanBase.replace(/\/+$/, "")}/prototype/${encodeURIComponent(
    projectId,
  )}`;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="bg-semantic-attention-subtle border-subtle text-default flex items-center justify-between gap-2 border-b px-4 py-1.5 text-xs">
        <span>
          <span className="font-semibold">Previewing PM Hub prototype</span>{" "}
          <code className="bg-emphasis text-emphasis ml-1 rounded px-1.5 py-0.5 font-mono text-[10px]">
            {projectId}
          </code>
        </span>
        <button
          type="button"
          onClick={() => setExited(true)}
          className="text-default hover:text-emphasis text-xs underline underline-offset-2"
        >
          Exit preview
        </button>
      </div>
      <iframe
        title={`PM Hub prototype preview · ${projectId}`}
        src={iframeSrc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
