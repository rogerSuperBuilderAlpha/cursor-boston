/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  MAINTAINER_ZOOM_JOIN_URL,
  MAINTAINER_ZOOM_MEETING_ID_DISPLAY,
  MAINTAINER_ZOOM_ORGANIZER,
  MAINTAINER_ZOOM_ONE_TAP,
} from "@/lib/maintainer-meeting";

type MaintainerPrBrief = {
  number: number;
  title: string;
  htmlUrl: string;
  authorLogin: string;
};

type QueuePayload = {
  notApprovedCount: number;
  notCommentedCount: number;
  notApproved: MaintainerPrBrief[];
  notCommented: MaintainerPrBrief[];
  approvedNotMerged: MaintainerPrBrief[];
  githubConfigured: boolean;
};

const panelClass =
  "rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 md:p-8";

function PrList({ items, emptyLabel }: { items: MaintainerPrBrief[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {items.slice(0, 20).map((pr) => (
        <li key={pr.number}>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            #{pr.number}
          </a>
          <span className="text-neutral-500"> · @{pr.authorLogin}</span>
          <span className="text-neutral-300"> — {pr.title}</span>
        </li>
      ))}
      {items.length > 20 ? (
        <li className="text-neutral-500">…and {items.length - 20} more</li>
      ) : null}
    </ul>
  );
}

export default function MaintainerDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gate, setGate] = useState<"loading" | "ready" | "error">("loading");
  const [queue, setQueue] = useState<QueuePayload | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "approved">("overview");

  const googleCalendarUrl = (() => {
    const text = encodeURIComponent("Cursor Boston — maintainer sync");
    const details = encodeURIComponent(
      `Weekly maintainer call (add a weekly recurrence in your calendar).\n\nJoin Zoom: ${MAINTAINER_ZOOM_JOIN_URL}\nMeeting ID: ${MAINTAINER_ZOOM_MEETING_ID_DISPLAY}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`;
  })();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/maintainers/dashboard");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const statusRes = await fetch("/api/maintainers/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!statusRes.ok) {
          setGate("error");
          return;
        }
        const statusJson = (await statusRes.json()) as { eligible?: boolean };
        if (!statusJson.eligible) {
          router.replace("/maintainers/apply");
          return;
        }

        const queueRes = await fetch("/api/maintainers/review-queue", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!queueRes.ok) {
          setGate("error");
          return;
        }
        setQueue((await queueRes.json()) as QueuePayload);
        setGate("ready");
      } catch {
        if (!cancelled) setGate("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  if (authLoading || !user || gate === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-6">
        <p className="text-neutral-400 text-sm">Loading maintainer dashboard…</p>
      </div>
    );
  }

  if (gate === "error") {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <p className="text-white font-medium mb-2">Could not load dashboard</p>
        <p className="text-neutral-400 text-sm mb-4">
          Check that you are signed in, GitHub is connected on your profile, and the server has a valid
          GitHub token for API access.
        </p>
        <Link href="/maintainers/apply" className="text-emerald-400 text-sm hover:underline">
          Back to apply
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="py-10 md:py-14 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <p className="mb-4">
            <Link href="/maintainers" className="text-sm text-neutral-500 hover:text-emerald-400">
              ← Maintainers
            </Link>
          </p>
          <h1 className="text-3xl font-bold text-white mb-2">Maintainer dashboard</h1>
          <p className="text-neutral-400">
            Weekly sync and open pull requests to <code className="text-violet-300">develop</code> that may
            need your review.
          </p>
        </div>
      </section>

      <section className="py-10 px-6 space-y-8 max-w-4xl mx-auto w-full">
        <div className={panelClass}>
          <h2 className="text-lg font-semibold text-white mb-1">Weekly maintainer call</h2>
          <p className="text-sm text-neutral-400 mb-4">
            {MAINTAINER_ZOOM_ORGANIZER} hosts a standing Zoom for maintainer sync. Add it to your calendar as
            a weekly event so you don&apos;t miss it.
          </p>
          <div className="space-y-3 text-sm text-neutral-300">
            <p>
              <span className="text-neutral-500">Join Zoom: </span>
              <a
                href={MAINTAINER_ZOOM_JOIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline break-all"
              >
                {MAINTAINER_ZOOM_JOIN_URL}
              </a>
            </p>
            <p>
              <span className="text-neutral-500">Meeting ID: </span>
              {MAINTAINER_ZOOM_MEETING_ID_DISPLAY}
            </p>
            <div>
              <p className="text-neutral-500 mb-1">One-tap mobile</p>
              <ul className="space-y-1">
                {MAINTAINER_ZOOM_ONE_TAP.map((row) => (
                  <li key={row.href}>
                    <a href={row.href} className="text-emerald-400 hover:underline">
                      {row.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-500 transition-colors"
            >
              Add to Google Calendar (template)
            </a>
            <p className="text-xs text-neutral-500 pt-2">
              In Google Calendar, set the event to repeat weekly on the day you meet. Other calendar apps can
              use the Zoom link and meeting ID above.
            </p>
          </div>
        </div>

        {queue && !queue.githubConfigured ? (
          <p className="text-amber-200/90 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            <code className="text-violet-300">GITHUB_TOKEN</code> is not set on this deployment. Open PR
            counts may be empty or unreliable until the server can reach the GitHub API.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Review queue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "approved"
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Approved, not merged
            {queue ? (
              <span className="text-neutral-500 ml-1">({queue.approvedNotMerged.length})</span>
            ) : null}
          </button>
        </div>

        {activeTab === "overview" && queue ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className={panelClass}>
              <p className="text-sm text-neutral-500 mb-1">Open PRs you have not commented on</p>
              <p className="text-4xl font-bold text-white mb-4">{queue.notCommentedCount}</p>
              <p className="text-xs text-neutral-500 mb-3">
                Counts non-draft PRs into <code className="text-violet-300">develop</code>, excluding your
                own. Comments include issue replies, review threads, and reviews with text or a comment-type
                review.
              </p>
              <PrList
                items={queue.notCommented}
                emptyLabel="You’ve commented on all open PRs in this queue, or there are none."
              />
            </div>
            <div className={panelClass}>
              <p className="text-sm text-neutral-500 mb-1">Open PRs you have not approved</p>
              <p className="text-4xl font-bold text-white mb-4">{queue.notApprovedCount}</p>
              <p className="text-xs text-neutral-500 mb-3">
                You haven’t submitted an approving review on GitHub yet for these PRs.
              </p>
              <PrList
                items={queue.notApproved}
                emptyLabel="You’ve approved all open PRs in this queue, or there are none."
              />
            </div>
          </div>
        ) : null}

        {activeTab === "approved" && queue ? (
          <div className={panelClass}>
            <h2 className="text-lg font-semibold text-white mb-2">Approved by you, still open</h2>
            <p className="text-sm text-neutral-400 mb-4">
              Pull requests into <code className="text-violet-300">develop</code> where your latest review
              is an approval, but the PR is not merged yet.
            </p>
            <PrList items={queue.approvedNotMerged} emptyLabel="No open PRs in this state." />
          </div>
        ) : null}
      </section>
    </div>
  );
}
