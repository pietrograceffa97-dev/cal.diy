"use client";

import { useDebounce } from "@calcom/lib/hooks/useDebounce";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";
import type { ReactElement } from "react";
import { useState } from "react";

import EventTypes, { EventTypesCTA, SearchContext } from "~/event-types/views/event-types-listing-view";

type GetUserEventGroupsResponse = Parameters<typeof EventTypesCTA>[0]["userEventGroupsData"];

const CTAWithContext = ({
  userEventGroupsData,
}: {
  userEventGroupsData: GetUserEventGroupsResponse;
}): ReactElement => {
  return <EventTypesCTA userEventGroupsData={userEventGroupsData} />;
};

export function EventTypesWrapper({
  userEventGroupsData,
  user,
}: {
  userEventGroupsData: GetUserEventGroupsResponse;
  user: {
    id: number;
    completedOnboarding?: boolean;
  } | null;
}): ReactElement {
  const { t } = useLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  return (
    <SearchContext.Provider value={{ searchTerm, setSearchTerm, debouncedSearchTerm }}>
      {/*
        Page-level blue background, scoped only to /event-types.
        Uses cal.diy's semantic `bg-cal-info` token so the change respects
        light/dark mode and stays inside the design system.
        Negative margins bleed past the shell's p-2/sm:p-4/lg:p-6 padding so
        the surface fills the main content area edge-to-edge; padding is
        restored inside so nothing else moves.
      */}
      <div
        data-testid="event-types-page-surface"
        className="bg-cal-info -m-2 min-h-[calc(100vh-1rem)] p-2 sm:-m-4 sm:min-h-[calc(100vh-2rem)] sm:p-4 lg:-m-6 lg:min-h-[calc(100vh-3rem)] lg:p-6">
        <ShellMainAppDir
          heading={t("event_types_page_title")}
          subtitle={t("event_types_page_subtitle")}
          CTA={<CTAWithContext userEventGroupsData={userEventGroupsData} />}>
          <EventTypes userEventGroupsData={userEventGroupsData} user={user} />
        </ShellMainAppDir>
      </div>
    </SearchContext.Provider>
  );
}
