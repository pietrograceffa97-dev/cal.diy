"use client";

import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";
import type { ReactElement } from "react";

import EventTypesPortfolioView from "~/event-types/views/event-types-portfolio-view";
import type { EventTypesCTA } from "~/event-types/views/event-types-listing-view";

// The legacy listing view's data shape — preserved here so the page.tsx server component
// can keep its data-fetch + prop-pass scaffolding unchanged. The portfolio redesign is
// presentational + uses mock data; the dev story will wire this prop through to the
// real cards.
type GetUserEventGroupsResponse = Parameters<typeof EventTypesCTA>[0]["userEventGroupsData"];

export function EventTypesWrapper({
  userEventGroupsData: _userEventGroupsData,
  user: _user,
}: {
  userEventGroupsData: GetUserEventGroupsResponse;
  user: {
    id: number;
    completedOnboarding?: boolean;
  } | null;
}): ReactElement {
  return (
    <ShellMainAppDir>
      <EventTypesPortfolioView />
    </ShellMainAppDir>
  );
}
