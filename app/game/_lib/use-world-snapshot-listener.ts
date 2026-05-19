/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db as firestoreDb } from "@/lib/firebase";
import {
  parseSnapshotDoc,
  type ClientWorldSnapshot,
  type ClientWorldSnapshotOwner,
} from "./parse-world-snapshot";

// Re-export the snapshot types so existing callers that pull these from
// the listener module keep working.
export type { ClientWorldSnapshot, ClientWorldSnapshotOwner };

// Detach from the live listener when the tab is hidden OR the user has
// been idle for this long. Firestore bills 1 read per delivered change,
// so a tab left open all weekend would otherwise stack up cron-rebuild
// reads (12/hour, possibly skipped by the gating but still potentially
// delivering on actual changes). Five minutes of inactivity is the same
// staleness bound the snapshot itself targets.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export interface WorldSnapshotListenerState {
  /** Latest delivered snapshot, or null while waiting for the first one. */
  snapshot: ClientWorldSnapshot | null;
  /** True when the live listener is currently attached. False while
   *  detached due to tab-hidden / idle / no Firestore SDK / no auth. */
  connected: boolean;
  /** ms-epoch timestamp of the most recent snapshot delivery, or null. */
  lastReceivedAt: number | null;
  /** Last error observed from the listener (e.g. permission denied
   *  before sign-in). Cleared on a successful delivery. */
  error: string | null;
}

/**
 * Real-time subscription to `game_world_snapshots/latest`.
 *
 * Behaviour:
 *   - Attaches a Firestore listener on mount (when the tab is visible
 *     and the user is active).
 *   - Detaches when the tab becomes hidden (`document.visibilityState
 *     === "hidden"`) and reattaches when it becomes visible again.
 *   - Detaches after IDLE_TIMEOUT_MS without keyboard / mouse / touch
 *     activity. Reattaches on the next activity event.
 *   - Cleans up on unmount.
 *
 * The hook gracefully no-ops in environments without the Web SDK
 * configured (e.g. SSR, test envs with placeholder env vars).
 */
export function useWorldSnapshotListener(opts: {
  /** Set to false to keep the listener detached entirely (e.g. while
   *  the user isn't authenticated). The snapshot doc requires auth. */
  enabled?: boolean;
} = {}): WorldSnapshotListenerState {
  const enabled = opts.enabled ?? true;

  const [state, setState] = useState<WorldSnapshotListenerState>({
    snapshot: null,
    connected: false,
    lastReceivedAt: null,
    error: null,
  });

  // Refs for the imperative connection lifecycle. Keeping these in refs
  // (rather than state) avoids re-running the effect every time the
  // listener attaches / detaches.
  const unsubRef = useRef<(() => void) | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!firestoreDb) {
      // Web SDK not configured — leave detached. The map UI keeps any
      // HTTP-fetched fallback data it already had.
      return;
    }
    const fdb = firestoreDb;

    const ref = doc(fdb, "game_world_snapshots", "latest");

    const attach = () => {
      if (unsubRef.current) return;
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) return;
          try {
            const parsed = parseSnapshotDoc(snap.data());
            setState({
              snapshot: parsed,
              connected: true,
              lastReceivedAt: Date.now(),
              error: null,
            });
          } catch (e) {
            setState((prev) => ({
              ...prev,
              connected: true,
              error: e instanceof Error ? e.message : "snapshot parse error",
            }));
          }
        },
        (err) => {
          setState((prev) => ({
            ...prev,
            connected: false,
            error: err.message ?? "snapshot listener error",
          }));
        }
      );
      unsubRef.current = unsub;
      setState((prev) => ({ ...prev, connected: true, error: null }));
    };

    const detach = () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
        setState((prev) => ({ ...prev, connected: false }));
      }
    };

    const armIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        // Detach only if no activity arrived during the window.
        if (Date.now() - lastActivityAtRef.current >= IDLE_TIMEOUT_MS) {
          detach();
        } else {
          armIdleTimer();
        }
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      lastActivityAtRef.current = Date.now();
      // If we were detached because of idle, reattach on the next
      // user input. Tab-hidden detaches stay detached until the
      // visibility event fires.
      if (
        !unsubRef.current &&
        document.visibilityState === "visible"
      ) {
        attach();
      }
      // Reset the idle countdown — we're alive.
      armIdleTimer();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        detach();
        if (idleTimerRef.current !== null) {
          window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
      } else {
        // Visible again — refresh the activity stamp and attach.
        lastActivityAtRef.current = Date.now();
        attach();
        armIdleTimer();
      }
    };

    // Initial wiring.
    document.addEventListener("visibilitychange", onVisibility);
    for (const evt of ACTIVITY_EVENTS) {
      document.addEventListener(evt, onActivity, { passive: true });
    }

    // Only attach if the page is visible right now. SSR hydration may
    // mount this hook on a hidden tab (preloaded link, etc.).
    if (document.visibilityState === "visible") {
      attach();
      armIdleTimer();
    }

    return () => {
      detach();
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, onActivity);
      }
    };
  }, [enabled]);

  return state;
}
