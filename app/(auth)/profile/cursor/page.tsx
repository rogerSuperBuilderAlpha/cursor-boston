/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { CursorIcon } from "@/components/icons";
import { useAuth } from "@/contexts/AuthContext";

const MONTHLY_CAP_OPTIONS = [
  { label: "$5", value: 5 },
  { label: "$25", value: 25 },
  { label: "$100", value: 100 },
  { label: "Unlimited", value: 0 },
];

function formatConnectionDate(value: unknown): string {
  if (!value) return "recently";
  const maybeTimestamp = value as { toDate?: () => Date };
  const date = maybeTimestamp.toDate ? maybeTimestamp.toDate() : new Date(value as string);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CursorConnectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading, refreshUserProfile } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [monthlyCapUsd, setMonthlyCapUsd] = useState(5);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorInfo = userProfile?.cursor ?? null;
  const requestedReturnPath = searchParams.get("return");
  const returnPath = requestedReturnPath?.startsWith("/") ? requestedReturnPath : "/pr-ideas";
  const capLabel = useMemo(() => {
    if (!cursorInfo) return null;
    return cursorInfo.monthlyCapUsd === 0
      ? "Unlimited"
      : `$${cursorInfo.monthlyCapUsd}`;
  }, [cursorInfo]);

  const connect = async () => {
    if (!user) return;
    setConnecting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/cursor/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey, monthlyCapUsd }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "invalid_key"
            ? "That Cursor API key could not be validated. Check that it is active and paste it again."
            : "Could not connect Cursor. Please try again."
        );
        return;
      }

      await refreshUserProfile();
      router.push(returnPath);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/cursor/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setError("Failed to disconnect Cursor. Please try again.");
        return;
      }

      await refreshUserProfile();
      router.push("/profile?cursor=disconnected");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[80vh] px-5 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="h-96 animate-pulse rounded-[2rem] border border-neutral-800 bg-neutral-950" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[80vh] px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 shadow-2xl shadow-emerald-950/20">
          <div className="border-b border-neutral-800 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_35%),linear-gradient(135deg,rgba(38,38,38,0.95),rgba(10,10,10,0.98))] p-7 md:p-9">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CursorIcon size={24} />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.3em] text-emerald-300">
                  Cursor account
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-white">
                  Connect Cursor
                </h1>
                <p className="mt-3 text-sm leading-6 text-neutral-300 md:text-base">
                  Store a Cursor Cloud Agents API key for features you explicitly start,
                  including the PR Idea Explorer.
                </p>
              </div>
            </div>
          </div>

          {cursorInfo ? (
            <div className="space-y-6 p-6 md:p-8">
              <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-sm font-medium text-emerald-300">
                  Connected as {cursorInfo.apiKeyFingerprint}
                </p>
                <p className="mt-2 text-sm text-neutral-400">
                  Connected {formatConnectionDate(cursorInfo.connectedAt)}
                  {cursorInfo.defaultModel ? ` with default model ${cursorInfo.defaultModel}` : ""}
                  {capLabel ? ` and a ${capLabel} monthly cap.` : "."}
                </p>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/pr-ideas"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-neutral-950 hover:bg-emerald-300"
                >
                  Open PR Idea Explorer
                </Link>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/30 px-5 py-3 font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Cursor"}
                </button>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          ) : (
            <div className="space-y-8 p-6 md:p-8">
              <section className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Create a key",
                    body: "Open Cursor's integrations dashboard and create a user API key for the Cloud Agents API.",
                  },
                  {
                    step: "2",
                    title: "Paste it here",
                    body: "We validate it once, encrypt it, and never show it again.",
                  },
                  {
                    step: "3",
                    title: "Set a cap",
                    body: "Choose a monthly cap before launching Cursor-powered features.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4"
                  >
                    <span className="text-xs font-semibold text-emerald-300">
                      Step {item.step}
                    </span>
                    <h2 className="mt-2 text-sm font-semibold text-white">{item.title}</h2>
                    <p className="mt-1 text-sm text-neutral-400">{item.body}</p>
                  </div>
                ))}
              </section>

              <a
                href="https://cursor.com/dashboard/integrations"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-300 transition-colors hover:text-emerald-200"
              >
                Open Cursor integrations dashboard
                <ExternalLink size={14} />
              </a>

              <section className="space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-white">Cursor API key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="cursor_..."
                    className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
                  />
                </label>

                <div>
                  <p className="mb-3 text-sm font-medium text-white">Monthly cap</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MONTHLY_CAP_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMonthlyCapUsd(option.value)}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                          monthlyCapUsd === option.value
                            ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                            : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 text-emerald-300" size={20} />
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      What we will and will not do
                    </h2>
                    <p className="mt-2 text-sm text-neutral-400">
                      We store your key encrypted at rest in a server-only document, validate it
                      before saving, and use it only after you explicitly start a
                      Cursor-powered feature. We will not display the key, share it with other
                      members, or launch agents from it as part of this connection flow.
                    </p>
                  </div>
                </div>
              </section>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={connect}
                disabled={connecting || !apiKey.trim()}
                className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-neutral-950 transition-colors hover:bg-emerald-300 disabled:opacity-50 disabled:hover:bg-emerald-400 sm:w-auto"
              >
                {connecting ? "Validating..." : "Connect Cursor"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CursorConnectionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[80vh] px-5 py-8 md:px-8 md:py-12">
          <div className="mx-auto max-w-3xl">
            <div className="h-96 animate-pulse rounded-[2rem] border border-neutral-800 bg-neutral-950" />
          </div>
        </main>
      }
    >
      <CursorConnectionContent />
    </Suspense>
  );
}
