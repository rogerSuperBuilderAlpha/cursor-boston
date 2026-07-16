/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { formatShortDate } from "@/lib/format-helpers";
import {
  buildEventMapEntries,
  getEventMapMarkers,
  type EventMapEntry,
} from "@/lib/events-map";
import type { Event } from "@/types/events";
import styles from "./EventMapExplorer.module.css";

const EventMapLeaflet = dynamic(
  () =>
    import("./EventMapLeaflet").then((module) => ({
      default: module.EventMapLeaflet,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-neutral-100 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        Loading map…
      </div>
    ),
  }
);

interface EventMapExplorerProps {
  events: Event[];
}

function sortEntries(entries: EventMapEntry[]): EventMapEntry[] {
  return [...entries].sort((left, right) => {
    if (left.event.date === "TBD") return 1;
    if (right.event.date === "TBD") return -1;
    return right.event.date.localeCompare(left.event.date);
  });
}

function EventListItem({
  entry,
  isSelected,
  onSelect,
}: {
  entry: EventMapEntry;
  isSelected: boolean;
  onSelect: (eventId: string) => void;
}) {
  const { event, marker } = entry;
  const dateLabel = event.date === "TBD" ? "Date TBD" : formatShortDate(event.date);

  const className = `rounded-xl border border-neutral-200 bg-white p-4 transition-colors dark:border-neutral-800 dark:bg-neutral-900 ${
    isSelected ? styles.listItemButtonSelected : "hover:border-neutral-300 dark:hover:border-neutral-700"
  }`;

  return (
    <article className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-600 dark:text-blue-400">
          {event.type}
        </span>
        {marker?.isPast ? (
          <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            Past
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Upcoming
          </span>
        )}
      </div>
      <h3 className="mt-2 text-base font-semibold text-foreground">{event.title}</h3>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {dateLabel} · {event.time}
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {event.venue?.name ?? event.location}
      </p>
      {event.venue?.address ? (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-500">
          {event.venue.address}
        </p>
      ) : null}
      {!marker ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Map pin unavailable — address not published yet.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {marker ? (
          <button
            type="button"
            className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            aria-pressed={isSelected}
            onClick={() => onSelect(marker.eventId)}
          >
            {isSelected ? "Selected on map" : "Show on map"}
          </button>
        ) : null}
        <Link
          href={`/events/${event.slug}`}
          className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          View event details
        </Link>
      </div>
    </article>
  );
}

export function EventMapExplorer({ events }: EventMapExplorerProps) {
  const reactId = useId().replace(/:/g, "");
  const mapTabId = `${reactId}-map-tab`;
  const listTabId = `${reactId}-list-tab`;
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const entries = useMemo(() => sortEntries(buildEventMapEntries(events)), [events]);
  const markers = useMemo(() => getEventMapMarkers(events), [events]);
  const mappableCount = markers.length;

  return (
    <div>
      <input
        type="radio"
        name={`event-map-view-${reactId}`}
        id={mapTabId}
        defaultChecked
        className={`${styles.srOnlyRadio} ${styles.radioMap}`}
      />
      <input
        type="radio"
        name={`event-map-view-${reactId}`}
        id={listTabId}
        className={`${styles.srOnlyRadio} ${styles.radioList}`}
      />

      <div className={styles.tabBar} role="tablist" aria-label="Event map views">
        <label htmlFor={mapTabId} className={styles.tabLabel} role="tab">
          Map view
        </label>
        <label htmlFor={listTabId} className={styles.tabLabel} role="tab">
          List view
        </label>
      </div>

      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        {mappableCount} of {events.length} events have map pins. Use list view for full keyboard
        access to every event.
      </p>

      <div className={styles.panels}>
        <section
          className={`${styles.panel} ${styles.panelMap}`}
          role="tabpanel"
          aria-label="Map of Boston-area Cursor Boston venues"
        >
          <div className={styles.mapFrame}>
            <EventMapLeaflet
              markers={markers}
              selectedEventId={selectedEventId}
              onSelect={setSelectedEventId}
            />
          </div>
        </section>

        <section
          className={`${styles.panel} ${styles.panelList}`}
          role="tabpanel"
          aria-label="List of Cursor Boston events"
        >
          <ul className="grid gap-4 md:grid-cols-2">
            {entries.map((entry) => (
              <li key={entry.event.id}>
                <EventListItem
                  entry={entry}
                  isSelected={entry.marker?.eventId === selectedEventId}
                  onSelect={setSelectedEventId}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function EventMapExplorerSummary({ eventCount, mappableCount }: {
  eventCount: number;
  mappableCount: number;
}) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        Explore {mappableCount} Boston-area venue{mappableCount === 1 ? "" : "s"} across{" "}
        {eventCount} community event{eventCount === 1 ? "" : "s"}. Switch to list view anytime —
        it works fully with keyboard navigation and screen readers.
      </p>
    </div>
  );
}
