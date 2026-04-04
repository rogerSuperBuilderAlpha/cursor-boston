"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLiveRemainingSeconds,
  useLiveSession,
  useLiveTimerAudioAlerts,
} from "@/lib/live-sessions/client";
import type { LiveSessionControlAction } from "@/lib/live-sessions/types";

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatTimestamp(timestampMs: number) {
  return new Date(timestampMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EmceeLiveSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { user, loading: authLoading } = useAuth();
  const [sessionId, setSessionId] = useState("");
  const { session, queue, loading, error } = useLiveSession(sessionId);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setSessionId(resolved.sessionId));
  }, [params]);

  useEffect(() => {
    setRemainingSeconds(getLiveRemainingSeconds(session));
    const interval = window.setInterval(() => {
      setRemainingSeconds(getLiveRemainingSeconds(session));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;

    const url = `${window.location.origin}/live/${sessionId}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: {
        dark: "#ffffff",
        light: "#00000000",
      },
    })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(null));
  }, [sessionId]);

  const queuedEntries = useMemo(
    () => queue.filter((entry) => entry.status === "queued"),
    [queue]
  );

  const isEmcee = Boolean(user && session && user.uid === session.emceeUid);
  const timerAlert =
    remainingSeconds === 0 && session?.timer.status === "running"
      ? "Time is up"
      : remainingSeconds <= 30 && session?.timer.status === "running"
      ? "30 second warning"
      : remainingSeconds <= 60 && session?.timer.status === "running"
      ? "1 minute warning"
      : null;
  const { audioEnabled, audioSupported, enableAudio } = useLiveTimerAudioAlerts(
    session,
    remainingSeconds
  );

  async function runAction(
    action: LiveSessionControlAction,
    extra?: { entryId?: string; targetIndex?: number }
  ) {
    if (!user || !sessionId) return;

    setPendingAction(`${action}:${extra?.entryId || ""}:${extra?.targetIndex ?? ""}`);
    setActionError(null);
    setActionMessage(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/live/${sessionId}/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Could not update live session.");
      }

      setActionMessage(
        action === "start-next"
          ? "Started the next speaker."
          : action === "pause-timer"
          ? "Timer paused."
          : action === "resume-timer"
          ? "Timer resumed."
          : action === "complete-current"
          ? "Speaker marked complete."
          : action === "skip-current"
          ? "Speaker skipped."
          : action === "end-session"
          ? "Session ended."
          : action === "remove-entry"
          ? "Speaker removed from queue."
          : "Queue updated."
      );
    } catch (controlError) {
      setActionError(
        controlError instanceof Error ? controlError.message : "Could not update live session."
      );
    } finally {
      setPendingAction(null);
    }
  }

  function handleDragStart(entryId: string) {
    setDraggedEntryId(entryId);
  }

  function handleDragEnd() {
    setDraggedEntryId(null);
  }

  function handleDrop(targetIndex: number) {
    if (!draggedEntryId || pendingAction !== null) return;
    void runAction("move-entry", { entryId: draggedEntryId, targetIndex });
    setDraggedEntryId(null);
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Emcee Controls</h1>
        <p className="mt-3 text-neutral-400">Sign in to manage this live session.</p>
        <Link
          href={`/login?redirect=/live/${sessionId}/emcee`}
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Session not found</h1>
        <p className="mt-3 text-neutral-400">{error || "This live session does not exist."}</p>
        <Link
          href="/live"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Create a Session
        </Link>
      </div>
    );
  }

  if (!isEmcee) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Read-only access</h1>
        <p className="mt-3 text-neutral-400">
          Only the session creator can use emcee controls. You can still watch the audience view.
        </p>
        <Link
          href={`/live/${sessionId}`}
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Open Audience View
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#050505_0%,_#0b1510_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Emcee Panel</p>
            <h1 className="mt-3 text-3xl font-semibold">{session.title}</h1>
            <p className="mt-3 text-neutral-300">
              Audience view:{" "}
              <Link className="text-emerald-300 underline underline-offset-4" href={session.audiencePath}>
                {session.audiencePath}
              </Link>
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Current Timer</p>
                <div className="mt-4 text-5xl font-semibold tabular-nums text-emerald-300">
                  {formatClock(remainingSeconds)}
                </div>
                <p className="mt-3 text-sm text-neutral-400">
                  Timer state: {session.timer.status}
                </p>
                {timerAlert ? (
                  <div className="mt-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white">
                    {timerAlert}
                  </div>
                ) : null}
                {audioSupported ? (
                  <button
                    type="button"
                    onClick={() => void enableAudio()}
                    className="mt-4 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-white/30"
                  >
                    {audioEnabled ? "Sound Cues On" : "Enable Sound Cues"}
                  </button>
                ) : null}
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Current Speaker</p>
                <div className="mt-4 text-xl font-medium">
                  {session.currentSpeaker.speakerName || "No speaker active"}
                </div>
                <p className="mt-2 text-neutral-400">
                  {session.currentSpeaker.talkTitle || "Start a queue control action next."}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => runAction("start-next")}
                disabled={pendingAction !== null}
                className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60"
              >
                Start Next
              </button>
              <button
                type="button"
                onClick={() => runAction("pause-timer")}
                disabled={pendingAction !== null}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 disabled:opacity-60"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() => runAction("resume-timer")}
                disabled={pendingAction !== null}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 disabled:opacity-60"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => runAction("complete-current")}
                disabled={pendingAction !== null}
                className="rounded-xl border border-emerald-500/40 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 disabled:opacity-60"
              >
                Complete
              </button>
              <button
                type="button"
                onClick={() => runAction("skip-current")}
                disabled={pendingAction !== null}
                className="rounded-xl border border-amber-500/40 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:border-amber-400 disabled:opacity-60"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => runAction("end-session")}
                disabled={pendingAction !== null}
                className="rounded-xl border border-rose-500/40 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400 disabled:opacity-60"
              >
                End Session
              </button>
            </div>
            {actionError ? <p className="mt-4 text-sm text-rose-400">{actionError}</p> : null}
            {actionMessage ? <p className="mt-4 text-sm text-emerald-300">{actionMessage}</p> : null}
          </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Join QR</p>
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/40 p-5">
              {qrCodeUrl ? (
                <Image
                  src={qrCodeUrl}
                  alt="QR code for audience live queue"
                  width={224}
                  height={224}
                  unoptimized
                  className="mx-auto h-56 w-56"
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-neutral-500">Generating QR code...</div>
              )}
            </div>
            <p className="mt-4 break-all text-sm text-neutral-400">
              {typeof window !== "undefined" ? `${window.location.origin}/live/${sessionId}` : session.audiencePath}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-neutral-500">
              Drag queue cards to reorder
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Speaker Queue</p>
              <h2 className="mt-2 text-2xl font-semibold">Queued speakers</h2>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-neutral-300">
              {queuedEntries.length} waiting
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {queuedEntries.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 px-5 py-8 text-neutral-500">
                No one is queued yet. Share the audience link or QR code to start filling the list.
              </div>
            ) : (
              queuedEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  draggable={pendingAction === null}
                  onDragStart={() => handleDragStart(entry.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  className={`flex items-center justify-between gap-4 rounded-[1.5rem] border px-5 py-4 ${
                    draggedEntryId === entry.id
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  <div>
                    <p className="text-sm text-neutral-500">#{index + 1}</p>
                    <p className="mt-1 text-lg font-medium text-white">{entry.talkTitle}</p>
                    <p className="mt-1 text-sm text-neutral-400">{entry.speakerName}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-neutral-300">
                      {entry.durationMinutes} min
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
                      Drag
                    </div>
                    <button
                      type="button"
                      onClick={() => runAction("move-entry", { entryId: entry.id, targetIndex: Math.max(0, index - 1) })}
                      disabled={pendingAction !== null || index === 0}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 disabled:opacity-40"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction("move-entry", {
                          entryId: entry.id,
                          targetIndex: Math.min(queuedEntries.length - 1, index + 1),
                        })
                      }
                      disabled={pendingAction !== null || index === queuedEntries.length - 1}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 disabled:opacity-40"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction("remove-entry", { entryId: entry.id })}
                      disabled={pendingAction !== null}
                      className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Session History</p>
              <h2 className="mt-2 text-2xl font-semibold">Completed talks</h2>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-neutral-300">
              {session.history.length} logged
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {session.history.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 px-5 py-8 text-neutral-500">
                Finished talks will appear here with timestamps.
              </div>
            ) : (
              [...session.history].reverse().map((item) => (
                <div
                  key={`${item.entryId}-${item.finishedAtMs}`}
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-black/40 px-5 py-4"
                >
                  <div>
                    <p className="text-sm text-neutral-500">{formatTimestamp(item.finishedAtMs)}</p>
                    <p className="mt-1 text-lg font-medium text-white">{item.talkTitle}</p>
                    <p className="mt-1 text-sm text-neutral-400">{item.speakerName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-neutral-300">
                      {item.durationMinutes} min
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-neutral-300">
                      {item.outcome}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
