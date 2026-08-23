/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pure RSVP helpers shared by the API and the client card.
 * Keep Firebase Admin out of this file so client components can import it.
 */

import eventsData from "@/content/events.json";
import type { Event, EventsData } from "@/types/events";

export const EVENT_RSVPS_COLLECTION = "eventRsvps";

const SPECIALIZED_EVENT_SLUGS = new Set([
  "cursor-boston-pydata-2026",
  "cursor-boston-sports-hack-2026",
  "cursor-boston-hack-a-sprint-2026",
]);

export type EventRsvpStatus = "none" | "confirmed" | "waitlisted";

export interface EventRsvpCounts {
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  remaining: number;
}

export interface EventRsvpSnapshot extends EventRsvpCounts {
  myStatus: EventRsvpStatus;
  waitlistPosition: number | null;
}

export interface ActiveRsvp {
  userId: string;
  createdAtMs: number;
}

function allCatalogEvents(): Event[] {
  const data = eventsData as EventsData;
  return [...data.upcoming, ...data.past, ...(data.oldEvents ?? [])];
}

export function findCatalogEventById(eventId: string): Event | undefined {
  return allCatalogEvents().find((event) => event.id === eventId);
}

export function eventSupportsOnSiteRsvp(
  event: Pick<Event, "slug" | "capacity" | "onSiteRsvp">
): boolean {
  return (
    event.onSiteRsvp === true &&
    typeof event.capacity === "number" &&
    event.capacity > 0 &&
    !SPECIALIZED_EVENT_SLUGS.has(event.slug)
  );
}

export function eventRsvpDocId(eventId: string, userId: string): string {
  return `${eventId}__${userId}`;
}

export function deriveRsvpSnapshot(
  active: readonly ActiveRsvp[],
  capacity: number,
  userId: string | null
): EventRsvpSnapshot {
  const sorted = [...active].sort((a, b) => {
    if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
    return a.userId.localeCompare(b.userId);
  });
  const confirmedCount = Math.min(sorted.length, capacity);
  const waitlistCount = Math.max(0, sorted.length - capacity);
  const remaining = Math.max(0, capacity - confirmedCount);

  let myStatus: EventRsvpStatus = "none";
  let waitlistPosition: number | null = null;
  if (userId) {
    const index = sorted.findIndex((row) => row.userId === userId);
    if (index >= 0 && index < capacity) {
      myStatus = "confirmed";
    } else if (index >= capacity) {
      myStatus = "waitlisted";
      waitlistPosition = index - capacity + 1;
    }
  }

  return {
    capacity,
    confirmedCount,
    waitlistCount,
    remaining,
    myStatus,
    waitlistPosition,
  };
}

export function getOnSiteRsvpEvent(eventId: string): Event | null {
  const event = findCatalogEventById(eventId);
  if (!event || !eventSupportsOnSiteRsvp(event) || typeof event.capacity !== "number") {
    return null;
  }
  return event;
}
