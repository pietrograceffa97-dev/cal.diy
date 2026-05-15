import { setUser as SentrySetUser } from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import React from "react";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";

import { buildLegacyRequest } from "@lib/buildLegacyCtx";

import Shell from "~/shell/Shell";

import { PmhubPreviewOverlay } from "./PmhubPreviewOverlay";

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (session?.user?.id) SentrySetUser({ id: session.user.id });

  // Server-side read so the URL never appears in NEXT_PUBLIC_* env
  // exposure. The overlay only activates when both the env var is
  // configured and the URL carries `?pmhub_project_id=...`.
  const pmhubBaseUrl =
    process.env.PMHUB_PUBLIC_URL ??
    "https://pm-agentic-hub-production.up.railway.app";

  return (
    <>
      <Shell withoutMain={true}>
        <PmhubPreviewOverlay pmhubBaseUrl={pmhubBaseUrl}>
          {children}
        </PmhubPreviewOverlay>
      </Shell>
    </>
  );
};

export default Layout;
