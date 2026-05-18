"use client";

/**
 * Event Types — Portfolio redesign (PRD: "Booking flow redesign — one product, three coherent screens").
 *
 * Replaces the legacy settings-table listing with a portfolio card grid. This view is presentational
 * — it uses mock data so the design intent can be reviewed independently of the tRPC data layer.
 * The dev story will rewire it to the real `getUserEventGroups` payload by mapping each event-type
 * row into the `PortfolioEventType` shape consumed by `EventTypePortfolioCard`.
 *
 * Preview states (exposed via the `?state=` query for the PM Hub iframe + the in-page state switcher):
 *   - default        — populated grid, no card hover
 *   - hover-preview  — first card has its hover-preview surface forced open
 *   - empty          — zero event types yet (first-run host)
 */

import { Button } from "@calcom/ui/components/button";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { TextField } from "@calcom/ui/components/form";
import { SearchIcon } from "@coss/ui/icons";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EventTypePortfolioCard, type PortfolioEventType } from "../components/EventTypePortfolioCard";

const MOCK_TYPES: PortfolioEventType[] = [
  {
    id: "1",
    title: "Intro call",
    slug: "intro",
    description:
      "A short, no-pressure conversation to figure out whether we should work together. Bring your problem; I'll bring the questions.",
    durationMinutes: 30,
    locationKind: "video",
    locationLabel: "Cal Video",
    bookerUrl: "cal.diy/pietro",
    hidden: false,
    hosts: [{ name: "Pietro Schirano", avatarUrl: "https://i.pravatar.cc/80?img=12" }],
    preview: {
      accentLabel: "Pietro Schirano",
      nextSlots: ["9:00", "9:30", "10:00"],
    },
  },
  {
    id: "2",
    title: "Design review",
    slug: "design-review",
    description:
      "Bring a Figma link or screenshots. We'll spend 45 minutes pulling apart the work and leaving you with three concrete next steps.",
    durationMinutes: 45,
    locationKind: "video",
    locationLabel: "Cal Video",
    bookerUrl: "cal.diy/pietro",
    hidden: false,
    hosts: [{ name: "Pietro Schirano", avatarUrl: "https://i.pravatar.cc/80?img=12" }],
    preview: {
      accentLabel: "Pietro Schirano",
      nextSlots: ["2:00", "2:45", "3:30"],
    },
  },
  {
    id: "3",
    title: "Coffee in SF",
    slug: "coffee",
    description:
      "If you're in San Francisco and want to meet IRL. I'll pick a café within walking distance of the Mission and confirm by email.",
    durationMinutes: 60,
    locationKind: "in-person",
    locationLabel: "San Francisco",
    bookerUrl: "cal.diy/pietro",
    hidden: false,
    hosts: [{ name: "Pietro Schirano", avatarUrl: "https://i.pravatar.cc/80?img=12" }],
    preview: {
      accentLabel: "Pietro Schirano",
      nextSlots: ["Tue", "Wed", "Fri"],
    },
  },
  {
    id: "4",
    title: "Team office hours",
    slug: "office-hours",
    description:
      "Open slot for anyone on the team to drop in with a question. Round-robin across our three engineers — whoever has time picks it up.",
    durationMinutes: 15,
    locationKind: "video",
    locationLabel: "Cal Video",
    bookerUrl: "cal.diy/team",
    hidden: false,
    hosts: [
      { name: "Pietro Schirano", avatarUrl: "https://i.pravatar.cc/80?img=12" },
      { name: "Alex Chen", avatarUrl: "https://i.pravatar.cc/80?img=32" },
      { name: "Sam Park", avatarUrl: "https://i.pravatar.cc/80?img=47" },
    ],
    preview: {
      accentLabel: "Acme team",
      nextSlots: ["11:15", "11:30", "11:45"],
    },
  },
  {
    id: "5",
    title: "Recruiter screen",
    slug: "recruiter",
    description:
      "For recruiters reaching out about roles. Tell me the company + comp band in the notes and I'll come prepared with a yes or a polite no.",
    durationMinutes: 20,
    locationKind: "phone",
    locationLabel: "Phone call",
    bookerUrl: "cal.diy/pietro",
    hidden: true,
    hosts: [{ name: "Pietro Schirano", avatarUrl: "https://i.pravatar.cc/80?img=12" }],
    preview: {
      accentLabel: "Pietro Schirano",
      nextSlots: ["4:00", "4:20", "4:40"],
    },
  },
  {
    id: "6",
    title: "Investor update",
    slug: "investor",
    description:
      "For existing investors only. Quarterly checkpoint — I'll share the deck the day before, you bring questions.",
    durationMinutes: 30,
    locationKind: "video",
    locationLabel: "Cal Video",
    bookerUrl: "cal.diy/pietro",
    hidden: false,
    hosts: [{ name: "Pietro Schirano", avatarUrl: "https://i.pravatar.cc/80?img=12" }],
    preview: {
      accentLabel: "Pietro Schirano",
      nextSlots: ["1:00", "1:30", "2:00"],
    },
  },
];

type ViewState = "default" | "hover-preview" | "empty";

const STATE_OPTIONS: { key: ViewState; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "hover-preview", label: "Hover preview" },
  { key: "empty", label: "Empty state" },
];

export default function EventTypesPortfolioView(): JSX.Element {
  const searchParams = useSearchParams();
  const queryState = searchParams?.get("state") as ViewState | null;
  const [stateOverride, setStateOverride] = useState<ViewState | null>(null);
  const activeState: ViewState =
    stateOverride ?? (queryState && STATE_OPTIONS.some((s) => s.key === queryState) ? queryState : "default");

  const [searchTerm, setSearchTerm] = useState("");
  const visibleTypes = useMemo(() => {
    if (!searchTerm.trim()) return MOCK_TYPES;
    const q = searchTerm.toLowerCase();
    return MOCK_TYPES.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  return (
    <div className="flex flex-col gap-6" data-preview-state={activeState}>
      {/* Header row — heading + search + new event */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-emphasis font-cal text-2xl font-semibold tracking-tight">
            Your booking experiences
          </h1>
          <p className="text-subtle mt-1 text-sm">
            Each card is a shareable link. Hover to peek at what your bookee will see.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TextField
            addOnLeading={<SearchIcon className="h-4 w-4 text-subtle" />}
            containerClassName="w-56 *:mb-0"
            type="search"
            value={searchTerm}
            autoComplete="off"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search experiences"
          />
          <Button data-testid="new-event-type" StartIcon="plus">
            New
          </Button>
        </div>
      </div>

      {/* In-page state switcher (prototype-only chrome — dev story strips this). */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-subtle bg-subtle/40 p-1 text-xs w-fit">
        <span className="text-subtle px-2">Preview state</span>
        {STATE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setStateOverride(opt.key)}
            data-active={activeState === opt.key || undefined}
            className="text-default data-[active]:bg-default data-[active]:text-emphasis rounded-md px-2.5 py-1 font-medium transition-colors data-[active]:shadow-sm">
            {opt.label}
          </button>
        ))}
      </div>

      {activeState === "empty" ? (
        <EmptyScreen
          Icon="link"
          headline="Start with your first booking experience"
          description="An event type is the link you share. Give it a purpose, a duration, and a location — bookees take it from there."
          buttonRaw={
            <Button StartIcon="plus" variant="button">
              Create your first event type
            </Button>
          }
        />
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="event-type-portfolio-grid">
          {visibleTypes.map((type, idx) => (
            <EventTypePortfolioCard
              key={type.id}
              type={type}
              forcePreviewOpen={activeState === "hover-preview" && idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
