/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function LiveSessionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("Lightning Talks");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateSession() {
    if (!user || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/live/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        sessionId?: string;
        error?: string;
      };

      if (!res.ok || !payload.sessionId) {
        throw new Error(payload.error || "Could not create live session.");
      }

      router.push(`/live/${payload.sessionId}/emcee`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create live session.");
    } finally {
      setIsCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Live Session Control Room</h1>
        <p className="mt-3 text-neutral-400">
          Sign in with an admin account to launch a lightning-talk session and open the emcee controls.
        </p>
        <Link
          href="/login?redirect=/live"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12">
      <div className="rounded-[2rem] border border-neutral-800 bg-neutral-950 p-8 shadow-2xl shadow-black/30">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Live Events</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Launch a lightning-talk session</h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-400">
          This creates a realtime queue and an emcee control room. Audience members can join from their phones once you share the session link or QR code.
        </p>

        <div className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-neutral-300" htmlFor="session-title">
            Session title
          </label>
          <input
            id="session-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-white outline-none transition focus:border-emerald-500"
            placeholder="Lightning Talks"
          />
          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCreateSession}
            disabled={isCreating}
            className="inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? "Creating..." : "Create Session"}
          </button>
          <Link
            href="/talks"
            className="inline-flex rounded-2xl border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white"
          >
            Back to Talks
          </Link>
        </div>
      </div>
    </div>
  );
}
