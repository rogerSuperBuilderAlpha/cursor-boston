/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { EventRsvpSnapshot } from "@/lib/event-rsvp-core";

interface EventRsvpCardProps {
  eventId: string;
  eventSlug: string;
  capacity: number;
}

type RsvpPayload = EventRsvpSnapshot & {
  success?: boolean;
  configured?: boolean;
  error?: string;
};

const emptySnapshot = (capacity: number): EventRsvpSnapshot => ({
  capacity,
  confirmedCount: 0,
  waitlistCount: 0,
  remaining: capacity,
  myStatus: "none",
  waitlistPosition: null,
});

export function EventRsvpCard({ eventId, eventSlug, capacity }: EventRsvpCardProps) {
  const { user } = useAuth();
  const requestKey = `${eventId}:${user?.uid ?? ""}`;
  const [snapshot, setSnapshot] = useState<EventRsvpSnapshot>(emptySnapshot(capacity));
  const [configured, setConfigured] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = loadedFor !== requestKey;

  const applyPayload = useCallback((data: RsvpPayload) => {
    setSnapshot({
      capacity: data.capacity,
      confirmedCount: data.confirmedCount,
      waitlistCount: data.waitlistCount,
      remaining: data.remaining,
      myStatus: data.myStatus,
      waitlistPosition: data.waitlistPosition ?? null,
    });
    setConfigured(data.configured !== false);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const headers: Record<string, string> = {};
        if (user) {
          headers.Authorization = `Bearer ${await user.getIdToken()}`;
        }
        const res = await fetch(`/api/events/${eventId}/rsvp`, { headers, signal });
        const data = (await res.json()) as RsvpPayload;
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(data.error || "Failed to load RSVP status");
          return;
        }
        setError(null);
        applyPayload(data);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("Error loading event RSVP:", err);
        setError("Failed to load RSVP status");
      } finally {
        if (!signal?.aborted) setLoadedFor(requestKey);
      }
    },
    [applyPayload, eventId, requestKey, user]
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function mutate(method: "POST" | "DELETE") {
    if (!user) {
      setError("Please sign in to RSVP.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: method === "POST" ? JSON.stringify({}) : undefined,
      });
      const data = (await res.json()) as RsvpPayload;
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      applyPayload(data);
    } catch (err) {
      console.error("Error updating event RSVP:", err);
      setError("Failed to update RSVP");
    } finally {
      setBusy(false);
    }
  }

  const statusCopy =
    snapshot.myStatus === "confirmed"
      ? "You have a confirmed spot."
      : snapshot.myStatus === "waitlisted"
        ? `You are #${snapshot.waitlistPosition ?? "?"} on the waitlist. If someone cancels, you move up automatically.`
        : `${snapshot.remaining} of ${snapshot.capacity} confirmed spots left.`;

  return (
    <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <h3 className="text-lg font-semibold text-foreground">RSVP on this site</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        First {snapshot.capacity} members are confirmed. Anyone after that joins
        the waitlist. Luma may still be used for door entry.
      </p>

      {loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-white/60 p-3 dark:bg-neutral-900/60">
              <dt className="text-neutral-500">Confirmed</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {snapshot.confirmedCount}/{snapshot.capacity}
              </dd>
            </div>
            <div className="rounded-lg bg-white/60 p-3 dark:bg-neutral-900/60">
              <dt className="text-neutral-500">Waitlist</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {snapshot.waitlistCount}
              </dd>
            </div>
            <div className="rounded-lg bg-white/60 p-3 dark:bg-neutral-900/60">
              <dt className="text-neutral-500">Open spots</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {snapshot.remaining}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300">{statusCopy}</p>

          {!configured ? (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              RSVPs are not stored in demo mode. Set up Firebase to persist them.
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            {!user ? (
              <Link
                href={`/login?redirect=${encodeURIComponent(`/events/${eventSlug}`)}`}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Sign in to RSVP
              </Link>
            ) : snapshot.myStatus === "none" ? (
              <button
                type="button"
                onClick={() => void mutate("POST")}
                disabled={busy || !configured}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {busy ? "Saving…" : snapshot.remaining > 0 ? "RSVP — confirmed spot" : "Join waitlist"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void mutate("DELETE")}
                disabled={busy || !configured}
                className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                {busy ? "Saving…" : "Cancel RSVP"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
