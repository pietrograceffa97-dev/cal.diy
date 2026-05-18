/**
 * Slot-picker route — `/[user]/[type]`.
 *
 * This file currently renders the **redesigned** presentational view for the booking-flow
 * redesign prototype (see PRD §2). The legacy data-bound view (`users-type-public-view`)
 * is preserved in `apps/web/modules/users/views/users-type-public-view.tsx` and the
 * `getServerSideProps` plumbing is left intact — the dev story will rewire the redesigned
 * view to consume those props.
 */

import type { PageProps } from "app/_types";
import { generateMeetingMetadata } from "app/_utils";
import { WEBAPP_URL } from "@calcom/lib/constants";
import type { Metadata } from "next";
import type React from "react";

import SlotPickerRedesignedView from "~/users/views/slot-picker-redesigned-view";

const ServerPage = async ({ params }: PageProps): Promise<JSX.Element> => {
  const resolvedParams = await params;
  const user = typeof resolvedParams.user === "string" ? resolvedParams.user : "pietro";
  const type = typeof resolvedParams.type === "string" ? resolvedParams.type : "30min";

  // Pretty event-title mapping — keeps the demo readable across whatever route the PM
  // hits (e.g. `/pietro/30min`, `/pietro/design-review`). The real implementation will
  // pull `eventData.title` from `getServerSideProps`.
  const prettyTitle = type
    .split("-")
    .map((s) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : ""))
    .join(" ");

  return (
    <SlotPickerRedesignedView
      hostUsername={user}
      hostName={user === "pietro" ? "Pietro Schirano" : user}
      eventTitle={prettyTitle || "Intro call"}
      durationMinutes={type.includes("60") ? 60 : type.includes("45") ? 45 : type.includes("15") ? 15 : 30}
    />
  );
};

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const resolvedParams = await params;
  const user = typeof resolvedParams.user === "string" ? resolvedParams.user : "";
  const type = typeof resolvedParams.type === "string" ? resolvedParams.type : "";
  return generateMeetingMetadata(
    {
      title: type,
      profile: { name: user, image: null },
      users: [{ name: user, username: user }],
    },
    () => `${type} | ${user}`,
    () => type,
    false,
    WEBAPP_URL,
    `/${user}/${type}`
  );
};

export default ServerPage;
