/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type React from "react";

interface PlatformRow {
  name: string;
  url: string;
  notes: React.ReactNode;
}

/** Free-tier numbers verified against each provider's pricing page in May 2026.
 *  These rot fast — when limits change, update the {name, notes} pair and the
 *  date in the section copy below. */
const HOST_PLATFORMS: readonly PlatformRow[] = [
  {
    name: "Vercel Hobby",
    url: "https://vercel.com/pricing",
    notes: (
      <>
        100 GB bandwidth/mo, 150K function invocations/mo, 60s function
        duration. Hard cap — once you hit it, deploys and functions stop
        until the next billing cycle. <strong>Non-commercial use only.</strong>
      </>
    ),
  },
  {
    name: "Netlify Free",
    url: "https://www.netlify.com/pricing/",
    notes: (
      <>
        100 GB bandwidth/mo, 300 build minutes/mo, 125K serverless function
        invocations/mo, 1M edge function invocations.
      </>
    ),
  },
  {
    name: "Cloudflare Pages",
    url: "https://pages.cloudflare.com/",
    notes: (
      <>
        <strong>Unlimited bandwidth</strong>, 500 builds/mo, 1 concurrent
        build, 100 custom domains. Pair with Cloudflare Workers (100K
        requests/day free) for serverless logic. Most generous free tier of
        the four.
      </>
    ),
  },
  {
    name: "Render",
    url: "https://render.com/pricing",
    notes: (
      <>
        Static sites free with 100 GB bandwidth/mo. Free web services get
        750 instance hours/mo but sleep after 15 min idle (~30s cold start).
      </>
    ),
  },
];

const BACKEND_PLATFORMS: readonly PlatformRow[] = [
  {
    name: "Firebase Spark",
    url: "https://firebase.google.com/pricing",
    notes: (
      <>
        50K MAU (auth), 1 GB Firestore + 50K reads/day + 20K writes/day, 5
        GB Cloud Storage, 10 GB Hosting. The per-day Firestore caps are the
        thing to watch.
      </>
    ),
  },
  {
    name: "Supabase Free",
    url: "https://supabase.com/pricing",
    notes: (
      <>
        500 MB Postgres, 1 GB file storage, 5 GB egress/mo, 50K MAU, 2
        active projects. <strong>Auto-pauses after 7 days of inactivity</strong> —
        you have to manually resume in the dashboard.
      </>
    ),
  },
  {
    name: "Convex Free",
    url: "https://www.convex.dev/pricing",
    notes: (
      <>
        1M function calls/mo, 0.5 GB database, 1 GB file storage. Strong if
        you want real-time queries baked in. Hard caps, no overage option.
      </>
    ),
  },
  {
    name: "Neon Free",
    url: "https://neon.com/pricing",
    notes: (
      <>
        100 CU-hours/mo per project, 0.5 GB storage per project (5 GB
        aggregate across up to 10 projects). Plain Postgres, no BaaS layer.
      </>
    ),
  },
];

function PlatformTable({
  rows,
  caption,
}: {
  rows: readonly PlatformRow[];
  caption: string;
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/50">
          <tr>
            <th scope="col" className="px-3 py-2 align-top">
              Platform
            </th>
            <th scope="col" className="px-3 py-2 align-top">
              Free tier (May 2026)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) => (
            <tr key={row.name} className="align-top">
              <td className="w-1/3 px-3 py-3">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
                >
                  {row.name}
                </a>
              </td>
              <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                {row.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WinnerCommitmentsCard() {
  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-base font-semibold">
        If you win a week-1/2/3 vote
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        Winners ship their platform somewhere public for the rest of the
        cohort to use, deal with real users (your fellow participants), and
        submit a short demo video at showcase time.
      </p>

      <div className="mt-5 space-y-6 text-sm text-neutral-700 dark:text-neutral-300">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Hosting costs — likely $0 at cohort scale, but verify your stack
          </h3>
          <p className="mt-2">
            You pick the stack and run the deploy. At cohort scale (~100
            users), the major free tiers are very likely to keep you at $0 —
            but limits exist, exceeding them is your responsibility, and we
            don&apos;t reimburse hosting bills. Always check the current
            pricing page before you commit; the figures below are accurate as
            of May 2026.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Pick a deploy/host
          </h3>
          <PlatformTable
            rows={HOST_PLATFORMS}
            caption="Frontend / deploy hosts and their May 2026 free tier limits"
          />
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Pick a backend / database (if you need one)
          </h3>
          <PlatformTable
            rows={BACKEND_PLATFORMS}
            caption="Backend and database providers and their May 2026 free tier limits"
          />
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Domain
          </h3>
          <p className="mt-1">
            We&apos;ll hand you a{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
              yourthing.cursorboston.com
            </code>{" "}
            subdomain — no DNS service to buy.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Managing real users is half the value
          </h3>
          <p className="mt-1">
            Whatever you build will have actual users — your cohort.
            Operating a platform with real people on it (handling questions,
            fixing what breaks, deciding what to ship next) is part of the
            educational experience. If you&apos;re already a senior operator,
            treat it as a portfolio piece.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Your demo can run locally
          </h3>
          <p className="mt-1">
            For the showcase you submit a short Loom/Vidyard video. You
            don&apos;t need a live URL — running the platform on your laptop
            during the demo is fine.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            You own everything you build
          </h3>
          <p className="mt-1">
            Whether or not you submit to win, the code is yours. Keep it
            private, open it, or evolve it into something else — your call.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Totally fine to not submit to win
          </h3>
          <p className="mt-1">
            You can participate fully without putting yourself up for the
            vote. There are 60+ people in Cohort 1 — we&apos;re not going to
            run short of volunteers. Everything else (building, voting, the
            in-person events, the demo day with hiring partners) is still
            yours. The only thing to skip is the &quot;submit to win&quot;
            step.
          </p>
        </div>
      </div>
    </section>
  );
}
