"use client";

import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@calcom/ui/components/dropdown";
import { Icon, type IconName } from "@calcom/ui/components/icon";
import { useState } from "react";

export type PortfolioEventType = {
  id: string;
  title: string;
  slug: string;
  description: string;
  durationMinutes: number;
  locationKind: "video" | "in-person" | "phone";
  locationLabel: string;
  bookerUrl: string;
  hidden: boolean;
  hosts: { name: string; avatarUrl?: string | null }[];
  /** Mocked "things a bookee will see" used by the hover preview. */
  preview: {
    accentLabel: string; // e.g. "Pietro Schirano"
    nextSlots: string[]; // e.g. ["9:00", "9:30", "10:00"]
  };
};

const locationIconByKind: Record<PortfolioEventType["locationKind"], IconName> = {
  video: "video",
  "in-person": "map-pin",
  phone: "phone",
};

export function EventTypePortfolioCard({
  type,
  /** When true, render with the hover-preview surface already revealed (used by the
   * portfolio's variant switcher so reviewers can evaluate the preview state without
   * needing to hover). */
  forcePreviewOpen = false,
}: {
  type: PortfolioEventType;
  forcePreviewOpen?: boolean;
}): JSX.Element {
  const [isPeeking, setIsPeeking] = useState(false);
  const showPreview = forcePreviewOpen || isPeeking;

  return (
    <div
      className="group bg-default border-subtle hover:border-emphasis relative flex flex-col overflow-hidden rounded-2xl border transition-colors focus-within:border-emphasis"
      data-testid={`event-type-card-${type.slug}`}
      data-preview-open={showPreview || undefined}
      onMouseEnter={() => setIsPeeking(true)}
      onMouseLeave={() => setIsPeeking(false)}
      onFocus={() => setIsPeeking(true)}
      onBlur={() => setIsPeeking(false)}>
      {/* Card body */}
      <a
        href={`/event-types/${type.id}?tabName=setup`}
        className="flex flex-1 flex-col gap-4 p-5 outline-none"
        tabIndex={0}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="bg-subtle text-emphasis flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Icon name={locationIconByKind[type.locationKind]} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-emphasis truncate text-base font-semibold">{type.title}</h3>
              <p className="text-subtle truncate text-xs">
                {type.bookerUrl}/{type.slug}
              </p>
            </div>
          </div>
          {type.hidden && (
            <Badge variant="gray" size="sm">
              Hidden
            </Badge>
          )}
        </div>

        <p className="text-default line-clamp-2 text-sm leading-relaxed">{type.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <Badge variant="gray" startIcon="clock" size="sm">
            {type.durationMinutes}m
          </Badge>
          <Badge variant="gray" startIcon={locationIconByKind[type.locationKind]} size="sm">
            {type.locationLabel}
          </Badge>
          {type.hosts.length > 1 && (
            <Badge variant="gray" startIcon="users" size="sm">
              {type.hosts.length} hosts
            </Badge>
          )}
        </div>
      </a>

      {/* Action row — secondary affordances, demoted */}
      <div className="border-subtle bg-subtle/40 flex items-center justify-between gap-2 border-t px-4 py-2.5">
        <div className="flex -space-x-1.5">
          {type.hosts.slice(0, 3).map((host) => (
            <Avatar
              key={host.name}
              alt={host.name}
              imageSrc={host.avatarUrl ?? undefined}
              size="xs"
              className="border-default border-2"
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            color="minimal"
            variant="icon"
            StartIcon="external-link"
            tooltip="Preview booking page"
            href={`${type.bookerUrl}/${type.slug}`}
            target="_blank"
          />
          <Button
            color="minimal"
            variant="icon"
            StartIcon="link"
            tooltip="Copy link"
            onClick={(e) => {
              e.preventDefault();
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(`${type.bookerUrl}/${type.slug}`);
              }
            }}
          />
          <Dropdown>
            <DropdownMenuTrigger asChild>
              <Button color="minimal" variant="icon" StartIcon="ellipsis" tooltip="More" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <DropdownItem type="button" StartIcon="pencil">
                  Edit
                </DropdownItem>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DropdownItem type="button" StartIcon="copy">
                  Duplicate
                </DropdownItem>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DropdownItem type="button" StartIcon={type.hidden ? "eye" : "eye-off"}>
                  {type.hidden ? "Show on profile" : "Hide from profile"}
                </DropdownItem>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <DropdownItem type="button" color="destructive" StartIcon="trash">
                  Delete
                </DropdownItem>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </Dropdown>
        </div>
      </div>

      {/* Hover preview hint — keyboard accessible via focus-within */}
      <div
        aria-hidden={!showPreview}
        className={`pointer-events-none absolute inset-x-0 bottom-0 origin-bottom transition-all duration-200 ${
          showPreview ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}>
        <div className="bg-inverted/95 mx-3 mb-3 rounded-xl p-3 shadow-dropdown backdrop-blur-sm">
          <p className="text-inverted text-[10px] font-medium uppercase tracking-wide opacity-60">
            What your bookee sees
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="bg-emphasis text-emphasis flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold">
              {type.preview.accentLabel
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-inverted truncate text-xs font-semibold">{type.preview.accentLabel}</p>
              <p className="text-inverted truncate text-[10px] opacity-70">
                {type.title} · {type.durationMinutes}m
              </p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1">
            {type.preview.nextSlots.map((slot, idx) => (
              <span
                key={slot}
                className={`text-inverted rounded-md py-1 text-center text-[10px] font-medium ${
                  idx === 0 ? "bg-brand-default text-brand" : "border-default border opacity-80"
                }`}>
                {slot}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
