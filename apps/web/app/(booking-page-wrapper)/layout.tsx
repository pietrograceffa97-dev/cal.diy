import { cookies, headers } from "next/headers";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";

import PageWrapper from "@components/PageWrapperAppDir";

import { buildLegacyRequest } from "@lib/buildLegacyCtx";

import PmhubAssistantWidget from "~/pmhub-assistant/PmhubAssistantWidget";

export default async function BookingPageWrapperLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const nonce = h.get("x-csp-nonce") ?? undefined;

  // PM Hub assistant on public booking pages: the widget's same-origin proxy
  // (/api/pmhub-assistant/*) requires a cal.diy session, so the orb only
  // renders for logged-in visitors (the QA tester) — anonymous bookers never
  // see it. The session lookup runs only on flag-enabled deploys.
  const assistantEnabled = process.env.NEXT_PUBLIC_ENABLE_PMHUB_ASSISTANT === "1";
  let assistantSignedIn = false;
  if (assistantEnabled) {
    const session = await getServerSession({ req: buildLegacyRequest(h, await cookies()) });
    assistantSignedIn = Boolean(session?.user?.id);
  }
  const assistantProjectId = process.env.NEXT_PUBLIC_PMHUB_PROJECT_ID ?? null;

  return (
    <>
      <PageWrapper isBookingPage={true} requiresLicense={false} nonce={nonce}>
        {children}
      </PageWrapper>
      {assistantEnabled && assistantSignedIn ? (
        <PmhubAssistantWidget enabled={true} projectId={assistantProjectId} />
      ) : null}
    </>
  );
}
