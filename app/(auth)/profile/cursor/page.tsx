/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
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

export default function CursorConnectionPage() {
  const router = useRouter();
  const { user, userProfile, loading, refreshUserProfile } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [monthlyCapUsd, setMonthlyCapUsd] = useState(5);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorInfo = userProfile?.cursor ?? null;
  const capLabel = useMemo(() => {
    if (!cursorInfo) return null;
    return cursorInfo.monthlyCapUsd === 0
      ? "Unlimited"
      : `$${cursorInfo.monthlyCapUsd}`;
  }, [cursorInfo]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/profile/cursor");
    }
  }, [loading, router, user]);

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
      router.push("/profile?cursor=success");
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

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <main className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to profile
        </Link>

        <div className="rounded-3xl border border-neutral-800 bg-neutral-950 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-neutral-800 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%),linear-gradient(135deg,rgba(38,38,38,0.9),rgba(10,10,10,0.95))]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center border border-emerald-500/20">
                <CursorIcon size={24} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300 mb-2">
                  Cursor connection
                </p>
                <h1 className="text-3xl md:text-4xl font-semibold text-white">
                  Connect your Cursor account
                </h1>
                <p className="text-neutral-300 mt-3 max-w-2xl">
                  Add a Cursor API key so future Cursor Boston features can start
                  user-approved cloud agents from your account.
                </p>
              </div>
            </div>
          </div>

          {cursorInfo ? (
            <div className="p-6 md:p-8 space-y-6">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-sm font-medium text-emerald-300">
                  Connected as {cursorInfo.apiKeyFingerprint}
                </p>
                <p className="text-sm text-neutral-400 mt-2">
                  Connected {formatConnectionDate(cursorInfo.connectedAt)}
                  {cursorInfo.defaultModel
                    ? ` with default model ${cursorInfo.defaultModel}`
                    : ""}
                  {capLabel ? ` and a ${capLabel} monthly cap.` : "."}
                </p>
              </div>

              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Activity log
                </h2>
                <p className="text-sm text-neutral-400">
                  Agent activity will appear here once Cursor-powered features
                  start launching runs.
                </p>
              </section>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={disconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect Cursor"}
              </button>
            </div>
          ) : (
            <div className="p-6 md:p-8 space-y-8">
              <section className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Create a key",
                    body: "Open Cursor's cloud agents dashboard and generate an API key.",
                  },
                  {
                    step: "2",
                    title: "Paste it here",
                    body: "We validate it once, encrypt it, and never show it again.",
                  },
                  {
                    step: "3",
                    title: "Set a cap",
                    body: "Choose a monthly cap now. Enforcement arrives with agent runs.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4"
                  >
                    <span className="text-xs font-semibold text-emerald-300">
                      Step {item.step}
                    </span>
                    <h2 className="text-sm font-semibold text-white mt-2">
                      {item.title}
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1">{item.body}</p>
                  </div>
                ))}
              </section>

              <a
                href="https://cursor.com/dashboard/cloud-agents"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                Open Cursor cloud agents dashboard
                <ExternalLink size={14} />
              </a>

              <section className="space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-white">
                    Cursor API key
                  </span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="cursor_..."
                    className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
                  />
                </label>

                <div>
                  <p className="text-sm font-medium text-white mb-3">
                    Monthly cap
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  <ShieldCheck className="text-emerald-300 mt-0.5" size={20} />
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      What we will and will not do
                    </h2>
                    <p className="text-sm text-neutral-400 mt-2">
                      We store your key encrypted at rest in a server-only
                      document, validate it before saving, and use it only after
                      you explicitly start a Cursor-powered feature. We will not
                      display the key, share it with other members, or launch
                      agents from it as part of this connection flow.
                    </p>
                  </div>
                </div>
              </section>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={connect}
                disabled={connecting || !apiKey.trim()}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-400 text-neutral-950 font-semibold hover:bg-emerald-300 disabled:opacity-50 disabled:hover:bg-emerald-400 transition-colors"
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
