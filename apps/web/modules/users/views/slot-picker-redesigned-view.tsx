"use client";

/**
 * /[user]/[type] — Slot picker redesign (PRD: "Booking flow redesign — one product, three coherent screens").
 *
 * Presentational redesign of the bookee-facing slot picker. Replaces the legacy
 * `users-type-public-view` rendering for this prototype. The dev story will wire it to the
 * real `getServerSideProps` payload (event metadata + availability slots).
 *
 * Two explicit modes (PRD §2):
 *   - browsing       — date + slot grid is the focal point; no dominant CTA
 *   - slot-selected  — the chosen slot rises in weight, the rest steps back, "Confirm" becomes dominant
 *
 * Mode is driven by `?slot=` in the URL so PM Hub's iframe can preview either state without UI interaction.
 */

import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type SlotPickerProps = {
  hostName?: string;
  hostUsername?: string;
  eventTitle?: string;
  durationMinutes?: number;
};

const DAYS = [
  { date: 12, weekday: "Mon", month: "Nov" },
  { date: 13, weekday: "Tue", month: "Nov" },
  { date: 14, weekday: "Wed", month: "Nov" },
  { date: 15, weekday: "Thu", month: "Nov" },
  { date: 16, weekday: "Fri", month: "Nov" },
];

const SLOTS_BY_DATE: Record<number, string[]> = {
  12: ["9:00", "9:30", "10:00", "10:30", "14:00", "14:30", "15:00"],
  13: ["9:30", "10:00", "11:00", "13:00", "13:30", "16:00"],
  14: ["9:00", "10:30", "11:00", "11:30", "14:00", "15:30"],
  15: ["10:00", "10:30", "13:00", "14:00", "14:30", "15:00", "16:30"],
  16: ["9:00", "9:30", "10:00", "13:30", "14:00"],
};

export default function SlotPickerRedesignedView({
  hostName = "Pietro Schirano",
  hostUsername = "pietro",
  eventTitle = "Intro call",
  durationMinutes = 30,
}: SlotPickerProps): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedSlotFromQuery = searchParams?.get("slot");
  const selectedDateFromQuery = Number(searchParams?.get("date")) || 13;

  const [selectedDate, setSelectedDate] = useState<number>(selectedDateFromQuery);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(selectedSlotFromQuery);

  const slots = SLOTS_BY_DATE[selectedDate] ?? [];
  const mode: "browsing" | "slot-selected" = selectedSlot ? "slot-selected" : "browsing";

  const selectedDay = useMemo(() => DAYS.find((d) => d.date === selectedDate) ?? DAYS[0], [selectedDate]);

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("slot", slot);
    params.set("date", String(selectedDate));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleClearSlot = () => {
    setSelectedSlot(null);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("slot");
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div
      className="bg-subtle min-h-screen"
      data-preview-state={mode}
      data-testid="slot-picker-redesigned">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-16">
        <div className="bg-default border-subtle overflow-hidden rounded-2xl border shadow-elevation-low">
          {/* Header — host + event */}
          <header className="border-subtle flex items-start gap-4 border-b px-6 py-5 sm:px-8 sm:py-6">
            <Avatar
              alt={hostName}
              imageSrc="https://i.pravatar.cc/120?img=12"
              size="md"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-subtle text-xs uppercase tracking-wide">{hostName}</p>
              <h1 className="text-emphasis mt-0.5 truncate text-xl font-semibold">{eventTitle}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="gray" startIcon="clock" size="sm">
                  {durationMinutes}m
                </Badge>
                <Badge variant="gray" startIcon="video" size="sm">
                  Cal Video
                </Badge>
              </div>
            </div>
          </header>

          {/* Body — date strip + slot grid + (mode-dependent) confirm panel */}
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            {/* Date strip */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-emphasis text-sm font-semibold">Pick a time</h2>
                <p className="text-subtle mt-0.5 text-xs">November 2025 · America/Los_Angeles</p>
              </div>
              <div className="flex items-center gap-1">
                <Button color="minimal" variant="icon" StartIcon="chevron-left" tooltip="Previous week" />
                <Button color="minimal" variant="icon" StartIcon="chevron-right" tooltip="Next week" />
              </div>
            </div>

            <div
              className="mt-4 grid grid-cols-5 gap-2"
              data-testid="date-strip"
              data-mode={mode}>
              {DAYS.map((day) => {
                const isSelected = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.date);
                      handleClearSlot();
                    }}
                    data-selected={isSelected || undefined}
                    className={`group relative flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition-all ${
                      isSelected
                        ? "border-emphasis bg-emphasis text-emphasis"
                        : "border-subtle bg-default text-default hover:border-emphasis"
                    } ${mode === "slot-selected" && !isSelected ? "opacity-50" : ""}`}>
                    <span className="text-xs font-medium uppercase opacity-70">{day.weekday}</span>
                    <span className="text-lg font-semibold tabular-nums">{day.date}</span>
                  </button>
                );
              })}
            </div>

            {/* Slot grid */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-emphasis text-sm font-semibold">
                  {selectedDay.weekday}, {selectedDay.month} {selectedDay.date}
                </h3>
                <span className="text-subtle text-xs">{slots.length} times available</span>
              </div>

              <div
                className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
                data-testid="slot-grid"
                data-mode={mode}>
                {slots.map((slot) => {
                  const isSelected = slot === selectedSlot;
                  const isFaded = mode === "slot-selected" && !isSelected;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      data-selected={isSelected || undefined}
                      aria-pressed={isSelected}
                      className={`relative flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium tabular-nums transition-all ${
                        isSelected
                          ? "border-emphasis bg-emphasis text-emphasis ring-2 ring-emphasis/40 ring-offset-2 ring-offset-default"
                          : "border-subtle bg-default text-default hover:border-emphasis hover:bg-subtle"
                      } ${isFaded ? "opacity-40" : ""}`}>
                      {isSelected && <Icon name="check" className="h-3.5 w-3.5" />}
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Demoted secondary controls — only visible in browsing mode */}
            {mode === "browsing" && (
              <div className="border-subtle mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <button
                  type="button"
                  className="text-subtle hover:text-emphasis flex items-center gap-1.5 text-xs font-medium transition-colors">
                  <Icon name="globe" className="h-3.5 w-3.5" />
                  America/Los_Angeles
                  <Icon name="chevron-down" className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="text-subtle hover:text-emphasis flex items-center gap-1.5 text-xs font-medium transition-colors">
                  <Icon name="grid-3x3" className="h-3.5 w-3.5" />
                  12h
                </button>
              </div>
            )}
          </div>

          {/* Slot-selected confirm strip — full-width primary, dominant when a slot is chosen */}
          {mode === "slot-selected" && selectedSlot && (
            <div
              className="border-subtle border-t bg-subtle/60 px-6 py-5 sm:px-8"
              data-testid="confirm-strip">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="calendar" className="text-emphasis h-4 w-4" />
                  <span className="text-emphasis font-semibold">
                    {selectedDay.weekday}, {selectedDay.month} {selectedDay.date} · {selectedSlot}
                  </span>
                  <span className="text-subtle">PST</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearSlot}
                  className="text-subtle hover:text-emphasis text-xs font-medium underline-offset-2 hover:underline">
                  Change time
                </button>
              </div>
              <Button className="mt-4 w-full" EndIcon="arrow-right">
                Continue with this time
              </Button>
            </div>
          )}
        </div>

        {/* Prototype-only state switcher */}
        <div className="mt-4 flex items-center justify-center gap-1 rounded-lg border border-subtle bg-default p-1 text-xs w-fit mx-auto">
          <span className="text-subtle px-2">Preview state</span>
          <button
            type="button"
            onClick={handleClearSlot}
            data-active={mode === "browsing" || undefined}
            className="text-default data-[active]:bg-subtle data-[active]:text-emphasis rounded-md px-2.5 py-1 font-medium">
            Browsing
          </button>
          <button
            type="button"
            onClick={() => handleSelectSlot(slots[2] ?? slots[0] ?? "10:00")}
            data-active={mode === "slot-selected" || undefined}
            className="text-default data-[active]:bg-subtle data-[active]:text-emphasis rounded-md px-2.5 py-1 font-medium">
            Slot selected
          </button>
        </div>

        {/* Cal.diy footer credit */}
        <p className="text-subtle mt-6 text-center text-xs">
          {hostUsername} · scheduled with cal.diy
        </p>
      </main>
    </div>
  );
}
