/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { LiveQueueEntryRecord, LiveSessionRealtimeRecord } from "./types";

interface LiveQueueState {
  order: string[];
  items: Record<string, LiveQueueEntryRecord>;
  updatedAtMs?: number;
}

export interface UseLiveSessionResult {
  session: LiveSessionRealtimeRecord | null;
  queue: LiveQueueEntryRecord[];
  loading: boolean;
  error: string | null;
}

function normalizeQueue(snapshotValue: unknown): LiveQueueEntryRecord[] {
  if (!snapshotValue || typeof snapshotValue !== "object") {
    return [];
  }

  const queueState = snapshotValue as LiveQueueState;
  const order = Array.isArray(queueState.order)
    ? queueState.order.filter((value): value is string => typeof value === "string")
    : [];
  const items =
    queueState.items && typeof queueState.items === "object" ? queueState.items : {};

  return order
    .map((entryId) => items[entryId])
    .filter((entry): entry is LiveQueueEntryRecord => Boolean(entry));
}

export function getLiveRemainingSeconds(session: LiveSessionRealtimeRecord | null): number {
  if (!session) return 0;

  const timer = session.timer;
  if (timer.status === "idle" || timer.status === "completed") {
    return timer.remainingSeconds;
  }

  if (timer.status === "paused" || !timer.startedAtMs) {
    return timer.remainingSeconds;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timer.startedAtMs) / 1000));
  return Math.max(0, timer.remainingSeconds - elapsedSeconds);
}

export function useLiveSession(sessionId: string): UseLiveSessionResult {
  const [session, setSession] = useState<LiveSessionRealtimeRecord | null>(null);
  const [queue, setQueue] = useState<LiveQueueEntryRecord[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    !sessionId ? null : !rtdb ? "Firebase Realtime Database is not configured." : null
  );
  const loading = Boolean(sessionId && rtdb && loadedSessionId !== sessionId);

  useEffect(() => {
    if (!sessionId || !rtdb) {
      return;
    }

    const sessionRef = ref(rtdb, `live_sessions/${sessionId}`);
    const queueRef = ref(rtdb, `live_queue_entries/${sessionId}`);

    const unsubscribeSession = onValue(
      sessionRef,
      (snapshot) => {
        setSession(snapshot.exists() ? (snapshot.val() as LiveSessionRealtimeRecord) : null);
        setLoadedSessionId(sessionId);
        setError(null);
      },
      () => {
        setError("Could not load live session state.");
        setLoadedSessionId(sessionId);
      }
    );

    const unsubscribeQueue = onValue(
      queueRef,
      (snapshot) => {
        setQueue(normalizeQueue(snapshot.val()));
      },
      () => {
        setError("Could not load live queue state.");
      }
    );

    return () => {
      unsubscribeSession();
      unsubscribeQueue();
    };
  }, [sessionId]);

  return useMemo(
    () => ({
      session,
      queue,
      loading,
      error,
    }),
    [session, queue, loading, error]
  );
}

type AudioPattern = Array<{ durationMs: number; frequency: number; gapMs?: number }>;

async function playAudioPattern(audioContext: AudioContext, pattern: AudioPattern) {
  let startAt = audioContext.currentTime;

  for (const tone of pattern) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = tone.frequency;
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      startAt + tone.durationMs / 1000
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + tone.durationMs / 1000);

    startAt += tone.durationMs / 1000 + (tone.gapMs ?? 120) / 1000;
  }
}

export function useLiveTimerAudioAlerts(
  session: LiveSessionRealtimeRecord | null,
  remainingSeconds: number
) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioSupported =
    typeof window !== "undefined" && typeof window.AudioContext !== "undefined";
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousRemainingRef = useRef<number | null>(null);

  const enableAudio = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      return false;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    setAudioEnabled(true);
    return true;
  }, []);

  useEffect(() => {
    const previousRemaining = previousRemainingRef.current;
    previousRemainingRef.current = remainingSeconds;

    if (!audioEnabled || !audioContextRef.current || session?.timer.status !== "running") {
      return;
    }

    const shouldPlayOneMinute =
      previousRemaining !== null && previousRemaining > 60 && remainingSeconds <= 60;
    const shouldPlayThirtySeconds =
      previousRemaining !== null && previousRemaining > 30 && remainingSeconds <= 30;
    const shouldPlayTimeUp =
      previousRemaining !== null && previousRemaining > 0 && remainingSeconds === 0;

    if (shouldPlayTimeUp) {
      void playAudioPattern(audioContextRef.current, [
        { frequency: 880, durationMs: 260 },
        { frequency: 880, durationMs: 260 },
        { frequency: 880, durationMs: 420 },
      ]);
      return;
    }

    if (shouldPlayThirtySeconds) {
      void playAudioPattern(audioContextRef.current, [
        { frequency: 740, durationMs: 220 },
        { frequency: 740, durationMs: 220 },
      ]);
      return;
    }

    if (shouldPlayOneMinute) {
      void playAudioPattern(audioContextRef.current, [
        { frequency: 620, durationMs: 220 },
      ]);
    }
  }, [audioEnabled, remainingSeconds, session?.timer.status]);

  return {
    audioEnabled,
    audioSupported,
    enableAudio,
  };
}
