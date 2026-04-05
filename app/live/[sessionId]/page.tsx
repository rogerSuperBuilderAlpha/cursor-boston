"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLiveRemainingSeconds,
  useLiveSession,
  useLiveTimerAudioAlerts,
} from "@/lib/live-sessions/client";

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AudienceLiveSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { user, loading: authLoading } = useAuth();
  const [sessionId, setSessionId] = useState("");
  const { session, queue, loading, error } = useLiveSession(sessionId);
  const [talkTitle, setTalkTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<3 | 5>(3);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

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

  const currentSpeakerLabel = useMemo(() => {
    if (!session?.currentSpeaker.speakerName) {
      return "Waiting for the next speaker";
    }
    return `${session.currentSpeaker.speakerName}${session.currentSpeaker.talkTitle ? `, ${session.currentSpeaker.talkTitle}` : ""}`;
  }, [session]);

  const upcomingQueue = queue.filter((entry) => entry.status === "queued");
  const userIsQueued = user ? upcomingQueue.some((entry) => entry.userId === user.uid) : false;
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

  async function handleJoinQueue(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !sessionId || submitting) return;

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/live/${sessionId}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          talkTitle,
          durationMinutes,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(payload.error || "Could not join the queue.");
      }

      setTalkTitle("");
      setDurationMinutes(3);
      setFormSuccess("You are in the queue. Keep this page open to watch the session.");
    } catch (joinError) {
      setFormError(joinError instanceof Error ? joinError.message : "Could not join the queue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(180deg,_#050505_0%,_#0b0b0b_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Live Queue</p>
          <h1 className="mt-3 text-3xl font-semibold">
            {session?.title || (loading ? "Loading session..." : "Live session")}
          </h1>
          <p className="mt-3 text-neutral-300">{error || currentSpeakerLabel}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-6">
              <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Now Speaking</p>
              <div className="mt-4 text-2xl font-medium">
                {session?.currentSpeaker.talkTitle || "Queue forming"}
              </div>
              <div className="mt-2 text-neutral-400">
                {session?.currentSpeaker.speakerName || "Emcee will start the first speaker soon"}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black p-6 text-center">
              <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Timer</p>
              <div
                className={`mt-4 text-6xl font-semibold tabular-nums ${
                  remainingSeconds <= 30
                    ? "text-rose-400"
                    : remainingSeconds <= 60
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                {formatClock(remainingSeconds)}
              </div>
              <div className="mt-3 text-sm text-neutral-400">
                {session?.timer.status ? `Status: ${session.timer.status}` : "Waiting for emcee"}
              </div>
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
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Up Next</p>
            <ol className="mt-5 space-y-3">
              {upcomingQueue.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-neutral-500">
                  No speakers queued yet.
                </li>
              ) : (
                upcomingQueue.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm text-neutral-400">#{index + 1}</p>
                      <p className="mt-1 font-medium text-white">{entry.talkTitle}</p>
                      <p className="mt-1 text-sm text-neutral-400">{entry.speakerName}</p>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-neutral-300">
                      {entry.durationMinutes} min
                    </div>
                  </li>
                ))
              )}
            </ol>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-neutral-400">Join Queue</p>
            {authLoading ? (
              <p className="mt-5 text-neutral-400">Checking your sign-in status...</p>
            ) : !user ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-5">
                <p className="text-neutral-300">
                  Sign in to add your lightning talk to the queue.
                </p>
                <Link
                  href={`/login?redirect=/live/${sessionId}`}
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
                >
                  Sign In
                </Link>
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleJoinQueue}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300" htmlFor="talk-title">
                    Talk title
                  </label>
                  <input
                    id="talk-title"
                    value={talkTitle}
                    onChange={(event) => setTalkTitle(event.target.value)}
                    maxLength={140}
                    required
                    disabled={userIsQueued}
                    className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="What are you demoing?"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-300">Duration</p>
                  <div className="flex gap-3">
                    {[3, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDurationMinutes(value as 3 | 5)}
                        disabled={userIsQueued}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          durationMinutes === value
                            ? "border-emerald-400 bg-emerald-400 text-black"
                            : "border-white/10 bg-black/40 text-neutral-200 hover:border-white/30"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {value} min
                      </button>
                    ))}
                  </div>
                </div>

                {formError ? (
                  <p className="text-sm text-rose-400" role="alert">
                    {formError}
                  </p>
                ) : null}
                {formSuccess ? (
                  <p className="text-sm text-emerald-300" role="status">
                    {formSuccess}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || userIsQueued}
                  className="inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {userIsQueued ? "Already in Queue" : submitting ? "Joining..." : "Join Queue"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
