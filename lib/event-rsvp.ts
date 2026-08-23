/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Firestore-backed on-site event RSVP (capacity + waitlist).
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  EVENT_RSVPS_COLLECTION,
  deriveRsvpSnapshot,
  eventRsvpDocId,
  getOnSiteRsvpEvent,
  type ActiveRsvp,
  type EventRsvpSnapshot,
} from "@/lib/event-rsvp-core";

export {
  EVENT_RSVPS_COLLECTION,
  deriveRsvpSnapshot,
  eventRsvpDocId,
  eventSupportsOnSiteRsvp,
  findCatalogEventById,
  getOnSiteRsvpEvent,
  type EventRsvpSnapshot,
  type EventRsvpStatus,
} from "@/lib/event-rsvp-core";

function timestampToMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as Timestamp).toMillis === "function"
  ) {
    return (value as Timestamp).toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
}

async function loadActiveRsvps(eventId: string): Promise<ActiveRsvp[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db
    .collection(EVENT_RSVPS_COLLECTION)
    .where("eventId", "==", eventId)
    .get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      if (data.status !== "active") return null;
      if (typeof data.userId !== "string") return null;
      return {
        userId: data.userId,
        createdAtMs: timestampToMs(data.createdAt),
      };
    })
    .filter((row): row is ActiveRsvp => row !== null);
}

export async function getEventRsvpSnapshot(
  eventId: string,
  userId: string | null
): Promise<{ configured: boolean; snapshot: EventRsvpSnapshot } | { error: string }> {
  const event = getOnSiteRsvpEvent(eventId);
  if (!event || typeof event.capacity !== "number") {
    return { error: "On-site RSVP is not enabled for this event." };
  }
  const db = getAdminDb();
  if (!db) {
    return {
      configured: false,
      snapshot: deriveRsvpSnapshot([], event.capacity, userId),
    };
  }
  const active = await loadActiveRsvps(eventId);
  return {
    configured: true,
    snapshot: deriveRsvpSnapshot(active, event.capacity, userId),
  };
}

export async function createEventRsvp(
  eventId: string,
  userId: string
): Promise<{ configured: boolean; snapshot: EventRsvpSnapshot } | { error: string }> {
  const event = getOnSiteRsvpEvent(eventId);
  if (!event || typeof event.capacity !== "number") {
    return { error: "On-site RSVP is not enabled for this event." };
  }
  const db = getAdminDb();
  if (!db) {
    return { error: "Event RSVP is not configured on this server." };
  }

  const docRef = db
    .collection(EVENT_RSVPS_COLLECTION)
    .doc(eventRsvpDocId(eventId, userId));
  const existing = await docRef.get();
  const alreadyActive = existing.exists && existing.data()?.status === "active";
  if (!alreadyActive) {
    await docRef.set({
      eventId,
      userId,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const active = await loadActiveRsvps(eventId);
  const hasSelf = active.some((row) => row.userId === userId);
  if (!hasSelf) {
    active.push({ userId, createdAtMs: Date.now() });
  }
  return {
    configured: true,
    snapshot: deriveRsvpSnapshot(active, event.capacity, userId),
  };
}

export async function cancelEventRsvp(
  eventId: string,
  userId: string
): Promise<{ configured: boolean; snapshot: EventRsvpSnapshot } | { error: string }> {
  const event = getOnSiteRsvpEvent(eventId);
  if (!event || typeof event.capacity !== "number") {
    return { error: "On-site RSVP is not enabled for this event." };
  }
  const db = getAdminDb();
  if (!db) {
    return { error: "Event RSVP is not configured on this server." };
  }

  const docRef = db
    .collection(EVENT_RSVPS_COLLECTION)
    .doc(eventRsvpDocId(eventId, userId));
  const existing = await docRef.get();
  if (!existing.exists || existing.data()?.status !== "active") {
    return { error: "You do not have an active RSVP for this event." };
  }

  await docRef.set(
    {
      status: "cancelled",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const active = await loadActiveRsvps(eventId);
  return {
    configured: true,
    snapshot: deriveRsvpSnapshot(
      active.filter((row) => row.userId !== userId),
      event.capacity,
      userId
    ),
  };
}
