/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  type FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DiscordIcon, GitHubIcon } from "@/components/icons";
import { useGithubConnection } from "@/app/(auth)/profile/_hooks/useGithubConnection";
import { useDiscordConnection } from "@/app/(auth)/profile/_hooks/useDiscordConnection";
import {
  SUMMER_COHORTS,
  SUMMER_COHORT_C1_DEFAULT_TAB,
  SUMMER_COHORT_C1_VOTE_WEEKS,
  SUMMER_COHORT_GOAL_PER_COHORT,
  SUMMER_COHORT_IMMERSION,
  SUMMER_COHORT_RETURN_TO,
  type SummerCohortId,
} from "@/lib/summer-cohort";
import { CohortProgramBreakdown } from "./_components/CohortProgramBreakdown";
import { CohortTabs, type CohortTabId } from "./_components/CohortTabs";
import { InfoTabPanel } from "./_components/InfoTabPanel";
import { Week4LudwittPanel } from "./_components/Week4LudwittPanel";
import { Week5StartupPanel } from "./_components/Week5StartupPanel";
import { Week6OssPanel } from "./_components/Week6OssPanel";
import { WeekVotePanel } from "./_components/WeekVotePanel";

interface ApplicationDto {
  userId: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  cohorts: SummerCohortId[];
  siteId: string | null;
  status: "pending" | "admitted" | "rejected" | "waitlist";
  isLocal: boolean | null;
  wantsToPresent: boolean | null;
  mayImmersionRsvped: boolean;
  createdAt: number | null;
  updatedAt: number | null;
}

type ApplicationCounts = Partial<Record<SummerCohortId, number>>;

const KICKOFF_NOTE =
  "First Zoom kickoffs: Cohort 1 on Mon May 11, Cohort 2 on Mon Jun 29. Watch your email and check back here for the meeting link and next steps.";

function CohortDatesList() {
  return (
    <ul className="space-y-2">
      {SUMMER_COHORTS.map((cohort) => (
        <li
          key={cohort.id}
          className="rounded-lg bg-neutral-100 border border-neutral-200 px-4 py-3 dark:bg-neutral-900 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{cohort.label}</span>
            <span className="text-xs text-neutral-600 dark:text-neutral-300">
              {cohort.startLabel} – {cohort.endLabel}
            </span>
          </div>
          <div className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {cohort.graduationLabel}
          </div>
        </li>
      ))}
    </ul>
  );
}

function scrollToConnections() {
  const el = document.getElementById("connections-heading");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function WhatToExpectTeaser() {
  return (
    <section className="mb-8 rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        What to expect
      </h2>
      <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
        Each cohort runs <strong>six weeks</strong>, with twice-weekly Zoom
        for demos and Q&amp;A and periodic in-person sessions in Boston.
        You&apos;ll build, present, vote on each other&apos;s work, ship to
        real users, and close with a demo day in front of hiring partners.
      </p>
      <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
        It&apos;s free. The only guarantee is the community itself — no jobs
        promised, no specific outcomes. The full week-by-week breakdown is
        shared once you apply.
      </p>
    </section>
  );
}

interface CounterCardProps {
  counts: ApplicationCounts;
  pickedCohorts: SummerCohortId[];
}

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

function PlatformTable({ rows, caption }: { rows: readonly PlatformRow[]; caption: string }) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/50">
          <tr>
            <th scope="col" className="px-3 py-2 align-top">Platform</th>
            <th scope="col" className="px-3 py-2 align-top">Free tier (May 2026)</th>
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

function WinnerCommitmentsCard() {
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
          <PlatformTable rows={HOST_PLATFORMS} caption="Frontend / deploy hosts and their May 2026 free tier limits" />
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Pick a backend / database (if you need one)
          </h3>
          <PlatformTable rows={BACKEND_PLATFORMS} caption="Backend and database providers and their May 2026 free tier limits" />
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

function ApplicationCounterCard({ counts, pickedCohorts }: CounterCardProps) {
  const pickedSet = new Set(pickedCohorts);
  const missingCohort = SUMMER_COHORTS.find((c) => !pickedSet.has(c.id));
  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Applications so far
      </h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Goal: <strong>{SUMMER_COHORT_GOAL_PER_COHORT} participants per cohort</strong>.
        Multi-cohort participants are encouraged — same applicant pool, more
        weeks to ship.
      </p>
      <ul className="mt-4 space-y-3">
        {SUMMER_COHORTS.map((cohort) => {
          const count = counts[cohort.id] ?? 0;
          const pct = Math.min(
            100,
            Math.round((count / SUMMER_COHORT_GOAL_PER_COHORT) * 100)
          );
          return (
            <li key={cohort.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{cohort.label}</span>
                <span className="tabular-nums text-neutral-700 dark:text-neutral-300">
                  <strong>{count}</strong>
                  <span className="text-neutral-500"> / {SUMMER_COHORT_GOAL_PER_COHORT}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {missingCohort ? (
        <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300">
          Want to do both?{" "}
          <strong>Add {missingCohort.label}</strong> in the form below — it
          takes one click and helps us hit the goal.
        </p>
      ) : (
        <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">
          Thanks for going all-in on both cohorts.
        </p>
      )}
    </section>
  );
}

interface StatusPanelProps {
  application: ApplicationDto;
  cohortLabel: (id: SummerCohortId) => string;
}

type StepState = "done" | "todo";

interface StepItem {
  state: StepState;
  title: string;
  body: React.ReactNode;
}

function NextStepsCard({
  application,
  needsDiscord,
  onEditDetails,
}: {
  application: ApplicationDto;
  needsDiscord: boolean;
  onEditDetails: () => void;
}) {
  const status = application.status;
  const isInCohort1 = application.cohorts.includes("cohort-1");
  const showImmersion = isInCohort1 && (status === "pending" || status === "admitted");
  const disclosuresMissing =
    application.isLocal === null || application.wantsToPresent === null;
  const showDiscord = status === "admitted" && needsDiscord;

  const items: StepItem[] = [];

  // Disclosures
  if (disclosuresMissing) {
    items.push({
      state: "todo",
      title: "Fill in the two new questions",
      body: (
        <>
          We added locality + comfort-with-presenting questions after you
          applied.{" "}
          <button
            type="button"
            onClick={onEditDetails}
            className="font-semibold underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-700 dark:decoration-amber-300/60"
          >
            Update them in your details →
          </button>
        </>
      ),
    });
  } else {
    items.push({
      state: "done",
      title: "Locality + presenting comfort recorded",
      body: (
        <>
          Local: <strong>{application.isLocal ? "yes" : "no"}</strong>.
          Comfortable presenting and maintaining the platform if you win:{" "}
          <strong>{application.wantsToPresent ? "yes" : "no"}</strong>.
        </>
      ),
    });
  }

  // May 26 RSVP — only relevant for cohort-1 in pending/admitted
  if (showImmersion) {
    if (application.mayImmersionRsvped) {
      items.push({
        state: "done",
        title: `${SUMMER_COHORT_IMMERSION.label} immersion event — RSVP confirmed`,
        body: (
          <>
            You&apos;re on the Luma list for the{" "}
            {SUMMER_COHORT_IMMERSION.title}. See you there.
          </>
        ),
      });
    } else {
      items.push({
        state: "todo",
        title: `RSVP for ${SUMMER_COHORT_IMMERSION.label} on Luma`,
        body: (
          <>
            Cohort 1 gets priority on the 80-person cap, but you still need to
            grab the seat.{" "}
            <a
              href={SUMMER_COHORT_IMMERSION.lumaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-700 dark:decoration-amber-300/60"
            >
              Reserve your spot →
            </a>
          </>
        ),
      });
    }
  }

  // Discord — only when admitted
  if (showDiscord) {
    items.push({
      state: "todo",
      title: "Connect Discord",
      body: (
        <>
          So we can add you to the cohort channel.{" "}
          <button
            type="button"
            onClick={scrollToConnections}
            className="font-semibold underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-700 dark:decoration-amber-300/60"
          >
            Jump to connections →
          </button>
        </>
      ),
    });
  }

  const allDone = items.every((i) => i.state === "done");

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        What&apos;s next
      </h2>
      {allDone ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          Nothing on your plate right now. We&apos;ll email you with the next
          step at each stage.
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`flex gap-3 rounded-lg border p-3 ${
              item.state === "done"
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.state === "done"
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {item.state === "done" ? "✓" : "!"}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p
                className={`font-semibold ${
                  item.state === "done"
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-amber-900 dark:text-amber-200"
                }`}
              >
                {item.title}
              </p>
              <p
                className={`mt-0.5 ${
                  item.state === "done"
                    ? "text-emerald-800/90 dark:text-emerald-300/90"
                    : "text-amber-900/90 dark:text-amber-200/90"
                }`}
              >
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApplicationStatusPanel({
  application,
  cohortLabel,
}: StatusPanelProps) {
  const status = application.status;
  const cohortText = application.cohorts.map(cohortLabel).join(" and ");

  const tone =
    status === "admitted"
      ? {
          panel:
            "mt-6 rounded-xl border border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-700 dark:bg-emerald-950/40",
          badge: "bg-emerald-500 text-white",
          label: "Status: Admitted",
          headline: `You're in! Welcome to ${cohortText || "the cohort"}.`,
          body:
            "Watch for a separate email with the Zoom kickoff link. Until then, get ready by skimming the program breakdown below.",
        }
      : status === "waitlist"
        ? {
            panel:
              "mt-6 rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30",
            badge: "bg-amber-500 text-white",
            label: "Status: Waitlist",
            headline: `You're on the waitlist for ${cohortText || "the cohort"}.`,
            body:
              "We'll let you know by email if a spot opens up. In the meantime, the program breakdown below is what you'd be joining.",
          }
        : status === "rejected"
          ? {
              panel:
                "mt-6 rounded-xl border border-neutral-300 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-900/60",
              badge: "bg-neutral-500 text-white",
              label: "Status: Not selected",
              headline: "We weren't able to fit you into this cohort round.",
              body: "Thanks for applying — we'd love for you to apply to a future cohort.",
            }
          : {
              panel:
                "mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30",
              badge: "bg-emerald-500 text-white",
              label: "Status: Pending",
              headline: `We received your application for ${cohortText || "the cohort"}.`,
              body: "We'll review and follow up by email. " + KICKOFF_NOTE,
            };

  return (
    <section className={tone.panel}>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.badge}`}
        >
          {tone.label}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
        {tone.headline}
      </p>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {tone.body}
      </p>
    </section>
  );
}

function SummerCohortPageInner() {
  const searchParams = useSearchParams();
  const { user, userProfile, loading, refreshUserProfile } = useAuth();

  const discord = useDiscordConnection(
    user,
    userProfile?.discord,
    SUMMER_COHORT_RETURN_TO
  );
  const github = useGithubConnection(
    user,
    userProfile?.github,
    userProfile?.provider,
    refreshUserProfile,
    SUMMER_COHORT_RETURN_TO
  );

  const [application, setApplication] = useState<ApplicationDto | null>(null);
  const [applicationCounts, setApplicationCounts] = useState<ApplicationCounts>({});
  const [appLoading, setAppLoading] = useState(false);
  const [appLoadError, setAppLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickedCohorts, setPickedCohorts] = useState<Set<SummerCohortId>>(
    new Set(SUMMER_COHORTS.map((c) => c.id))
  );
  const [isLocal, setIsLocal] = useState<boolean | null>(null);
  const [wantsToPresent, setWantsToPresent] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  /** Existing applicants see the "Your details" card collapsed by default;
   *  expanding shows the editable form. */
  const [editingDetails, setEditingDetails] = useState(false);

  const [activeTab, setActiveTab] = useState<CohortTabId>(
    SUMMER_COHORT_C1_DEFAULT_TAB
  );

  const openEditDetails = useCallback(() => {
    setEditingDetails(true);
    // Defer scroll one tick so the form has mounted.
    requestAnimationFrame(() => {
      const el = document.getElementById("your-details-heading");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // Default name from auth profile once it loads.
  useEffect(() => {
    if (user && !name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prefilling form once auth subject becomes available
      setName(user.displayName || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch existing application.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      setAppLoading(true);
      setAppLoadError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/summer-cohort/apply", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const json = (await res.json()) as {
          application: ApplicationDto | null;
          applicationCounts?: ApplicationCounts;
        };
        if (!cancelled) {
          setApplication(json.application);
          setApplicationCounts(json.applicationCounts ?? {});
          // Hydrate the form from the existing application so the edit
          // experience pre-fills everything they already submitted.
          if (json.application) {
            setName(json.application.name || user.displayName || "");
            setPhone(json.application.phone || "");
            setPickedCohorts(new Set(json.application.cohorts));
            setIsLocal(json.application.isLocal);
            setWantsToPresent(json.application.wantsToPresent);
          }
        }
      } catch {
        if (!cancelled) setAppLoadError("Couldn't load your application status.");
      } finally {
        if (!cancelled) setAppLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  // Handle OAuth callbacks landed on this page.
  useEffect(() => {
    if (loading) return;
    const githubStatus = searchParams.get("github");
    if (githubStatus) {
      const data = searchParams.get("data");
      if (githubStatus === "success" && data) {
        try {
          github.handleOAuthSuccess(JSON.parse(decodeURIComponent(data)));
        } catch {
          github.handleOAuthError();
        }
      } else if (githubStatus === "error") {
        github.handleOAuthError();
      }
    }
    const discordStatus = searchParams.get("discord");
    if (discordStatus) {
      const data = searchParams.get("data");
      if (discordStatus === "success" && data) {
        try {
          discord.handleOAuthSuccess(JSON.parse(decodeURIComponent(data)));
        } catch {
          discord.handleOAuthError(searchParams.get("message"));
        }
      } else if (discordStatus === "error") {
        discord.handleOAuthError(searchParams.get("message"));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  const toggleCohort = useCallback((id: SummerCohortId) => {
    setPickedCohorts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitError(null);
    setSubmitSuccess(null);

    const cohorts = Array.from(pickedCohorts);
    if (cohorts.length === 0) {
      setSubmitError("Pick at least one cohort.");
      return;
    }
    if (!name.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!phone.trim()) {
      setSubmitError("Please enter a phone number.");
      return;
    }
    if (isLocal === null) {
      setSubmitError("Tell us whether you're local and plan to attend live events.");
      return;
    }
    if (wantsToPresent === null) {
      setSubmitError(
        "Tell us whether you're comfortable presenting and managing the platform if you win."
      );
      return;
    }

    const isUpdate = application !== null;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/summer-cohort/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          cohorts,
          isLocal,
          wantsToPresent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(typeof json.error === "string" ? json.error : "Submit failed.");
        return;
      }
      setApplication(json.application as ApplicationDto);
      if (json.applicationCounts) {
        setApplicationCounts(json.applicationCounts as ApplicationCounts);
      }
      if (isUpdate) {
        setSubmitSuccess("Saved.");
        setEditingDetails(false);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async () => {
    if (!user) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Withdraw your Summer Cohort application? This will remove your application from our system."
      )
    ) {
      return;
    }
    setWithdrawError(null);
    setWithdrawing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/summer-cohort/apply", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setWithdrawError(
          typeof json.error === "string" ? json.error : "Failed to withdraw."
        );
        return;
      }
      setApplication(null);
      setName(user.displayName || "");
      setPhone("");
      setPickedCohorts(new Set(SUMMER_COHORTS.map((c) => c.id)));
      setIsLocal(null);
      setWantsToPresent(null);
      setSubmitSuccess(null);
      setEditingDetails(false);
    } catch {
      setWithdrawError("Network error. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  const cohortLabel = useMemo(() => {
    const map = new Map(SUMMER_COHORTS.map((c) => [c.id, c.label] as const));
    return (id: SummerCohortId) => map.get(id) || id;
  }, []);

  const showTabs =
    application?.status === "admitted" &&
    application.cohorts.includes("cohort-1");
  const myInfoVisible = !showTabs || activeTab === "my-info";
  const cohort1Count = applicationCounts["cohort-1"] ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <Sun className="h-3.5 w-3.5" strokeWidth={2.25} />
          Summer Cohort
        </div>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">
          Cursor Boston Summer Cohort
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Two six-week sessions to build with Cursor alongside other Boston
          developers, founders, and students.
        </p>
      </header>

      {!showTabs ? (
      <section aria-labelledby="cohort-dates-heading" className="mb-8">
        <h2
          id="cohort-dates-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500"
        >
          Dates
        </h2>
        <CohortDatesList />
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {KICKOFF_NOTE}
        </p>
      </section>
      ) : null}

      {/* Pre-apply teaser — visible until the user submits an application. */}
      {!application ? <WhatToExpectTeaser /> : null}

      {/* Auth-gated states */}
      {loading ? (
        <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
          Loading…
        </div>
      ) : !user ? (
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
          <h2 className="text-lg font-semibold">Sign in to apply</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            We need an account on file to follow up on your application.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(SUMMER_COHORT_RETURN_TO)}`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            Sign in
          </Link>
        </section>
      ) : appLoading ? (
        <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
          Checking your application…
        </div>
      ) : appLoadError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {appLoadError}
        </div>
      ) : (
        <>
          {application ? (
            showTabs ? (
              <>
                <ApplicationStatusPanel
                  application={application}
                  cohortLabel={cohortLabel}
                />
                <NextStepsCard
                  application={application}
                  needsDiscord={!discord.discordInfo}
                  onEditDetails={openEditDetails}
                />
                <CohortTabs
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />
                <div className="mt-4">
                  {activeTab === "info" ? (
                    <InfoTabPanel cohort1Count={cohort1Count} />
                  ) : activeTab === "week-1" ? (
                    <WeekVotePanel
                      week={SUMMER_COHORT_C1_VOTE_WEEKS[0]}
                      tabId="week-1"
                    />
                  ) : activeTab === "week-2" ? (
                    <WeekVotePanel
                      week={SUMMER_COHORT_C1_VOTE_WEEKS[1]}
                      tabId="week-2"
                    />
                  ) : activeTab === "week-3" ? (
                    <WeekVotePanel
                      week={SUMMER_COHORT_C1_VOTE_WEEKS[2]}
                      tabId="week-3"
                    />
                  ) : activeTab === "week-4" ? (
                    <Week4LudwittPanel />
                  ) : activeTab === "week-5" ? (
                    <Week5StartupPanel />
                  ) : activeTab === "week-6" ? (
                    <Week6OssPanel />
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <ApplicationStatusPanel
                  application={application}
                  cohortLabel={cohortLabel}
                />
                <NextStepsCard
                  application={application}
                  needsDiscord={!discord.discordInfo}
                  onEditDetails={openEditDetails}
                />
                <ApplicationCounterCard
                  counts={applicationCounts}
                  pickedCohorts={application.cohorts}
                />
                <CohortProgramBreakdown />
                <WinnerCommitmentsCard />
              </>
            )
          ) : null}
          {myInfoVisible ? (
          <section
            className={`${application ? "mt-6" : ""} rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="your-details-heading"
                  className="text-lg font-semibold"
                >
                  {application ? "Your details" : "Apply"}
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {application
                    ? editingDetails
                      ? "Update anything here and hit Save. Your status stays the same."
                      : "What we have on file for your application."
                    : "Fill this out and we'll be in touch."}
                </p>
              </div>
              {application && !editingDetails ? (
                <button
                  type="button"
                  onClick={() => setEditingDetails(true)}
                  className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Edit
                </button>
              ) : null}
            </div>

            {application && !editingDetails ? (
              <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Name
                  </dt>
                  <dd className="mt-1">{application.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Email
                  </dt>
                  <dd className="mt-1 break-all">{application.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Phone
                  </dt>
                  <dd className="mt-1">{application.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Cohorts
                  </dt>
                  <dd className="mt-1">
                    {application.cohorts.length > 0
                      ? application.cohorts.map(cohortLabel).join(" + ")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Local + attending live events
                  </dt>
                  <dd className="mt-1">
                    {application.isLocal === null
                      ? <span className="text-amber-700 dark:text-amber-400">Not set</span>
                      : application.isLocal
                        ? "Yes"
                        : "No (remote)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Comfortable presenting + maintaining
                  </dt>
                  <dd className="mt-1">
                    {application.wantsToPresent === null
                      ? <span className="text-amber-700 dark:text-amber-400">Not set</span>
                      : application.wantsToPresent
                        ? "Yes"
                        : "No"}
                  </dd>
                </div>
              </dl>
            ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="cohort-name"
                  className="block text-sm font-medium"
                >
                  Name
                </label>
                <input
                  id="cohort-name"
                  type="text"
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label
                  htmlFor="cohort-email"
                  className="block text-sm font-medium"
                >
                  Email
                </label>
                <input
                  id="cohort-email"
                  type="email"
                  value={user.email || ""}
                  readOnly
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400"
                />
              </div>
              <div>
                <label
                  htmlFor="cohort-phone"
                  className="block text-sm font-medium"
                >
                  Phone
                </label>
                <input
                  id="cohort-phone"
                  type="tel"
                  required
                  maxLength={50}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <fieldset>
                <legend className="block text-sm font-medium">
                  Which cohort(s)? Pick at least one.
                </legend>
                <div className="mt-2 space-y-2">
                  {SUMMER_COHORTS.map((cohort) => (
                    <label
                      key={cohort.id}
                      className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm dark:border-neutral-800"
                    >
                      <input
                        type="checkbox"
                        checked={pickedCohorts.has(cohort.id)}
                        onChange={() => toggleCohort(cohort.id)}
                        className="h-4 w-4 rounded border-neutral-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="font-semibold">{cohort.label}</span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {cohort.startLabel} – {cohort.endLabel}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="block text-sm font-medium">
                  Are you local to Boston and planning to attend the live
                  events?
                </legend>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  It&apos;s completely fine to participate from outside Boston —
                  most of the cohort is on Zoom. We just need to know who&apos;s
                  local. <strong>Heads up:</strong> for the first 3 weeks
                  (PM/comms/marketing tool weeks), in-person attendance at the
                  live demo events is mandatory if you want to be eligible to
                  win that week&apos;s vote.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm dark:border-neutral-800">
                    <input
                      type="radio"
                      name="cohort-is-local"
                      checked={isLocal === true}
                      onChange={() => setIsLocal(true)}
                      className="h-4 w-4 border-neutral-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>
                      Yes — I&apos;m local and plan to attend live events
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm dark:border-neutral-800">
                    <input
                      type="radio"
                      name="cohort-is-local"
                      checked={isLocal === false}
                      onChange={() => setIsLocal(false)}
                      className="h-4 w-4 border-neutral-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>
                      No — remote only (skipping the live events is fine)
                    </span>
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend className="block text-sm font-medium">
                  If you win a week-1/2/3 vote, are you comfortable presenting
                  AND managing the platform for the rest of the cohort?
                </legend>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Not everyone has to present — only people who are comfortable
                  doing it AND comfortable maintaining the winning platform
                  through the rest of the cohort. Say no and you can still
                  participate fully; you just won&apos;t be eligible to win the
                  vote that week.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm dark:border-neutral-800">
                    <input
                      type="radio"
                      name="cohort-wants-to-present"
                      checked={wantsToPresent === true}
                      onChange={() => setWantsToPresent(true)}
                      className="h-4 w-4 border-neutral-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Yes — count me in to present and maintain</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm dark:border-neutral-800">
                    <input
                      type="radio"
                      name="cohort-wants-to-present"
                      checked={wantsToPresent === false}
                      onChange={() => setWantsToPresent(false)}
                      className="h-4 w-4 border-neutral-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>No — I&apos;ll participate but not present</span>
                  </label>
                </div>
              </fieldset>
              {submitError ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              ) : null}
              {submitSuccess ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {submitSuccess}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {submitting
                      ? application
                        ? "Saving…"
                        : "Submitting…"
                      : application
                        ? "Save updates"
                        : "Submit application"}
                  </button>
                  {application && editingDetails ? (
                    <button
                      type="button"
                      onClick={() => setEditingDetails(false)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
                {application ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {withdrawError ? (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {withdrawError}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={withdraw}
                      disabled={withdrawing}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      {withdrawing ? "Withdrawing…" : "Withdraw application"}
                    </button>
                  </div>
                ) : null}
              </div>
            </form>
            )}
          </section>
          ) : null}
        </>
      )}

      {/* Connections panel — visible whenever the user is signed in. */}
      {user && myInfoVisible ? (
        <section
          aria-labelledby="connections-heading"
          className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h2
            id="connections-heading"
            className="text-sm font-semibold uppercase tracking-wider text-neutral-500"
          >
            Connect your accounts
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Connect GitHub and Discord so we can verify membership and add you
            to the cohort channel.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-800">
                  <GitHubIcon size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium">GitHub</p>
                  {github.githubInfo ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Connected as {github.githubInfo.login}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500">Not connected</p>
                  )}
                </div>
              </div>
              {github.githubInfo ? (
                <button
                  onClick={github.disconnect}
                  disabled={github.disconnecting}
                  className="text-xs text-neutral-500 transition-colors hover:text-red-500 disabled:opacity-50"
                >
                  {github.disconnecting ? "…" : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={github.connect}
                  disabled={github.connecting}
                  className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-500 disabled:opacity-50 dark:text-emerald-400"
                >
                  {github.connecting ? "…" : "Connect"}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5865F2]/10">
                  <DiscordIcon size={18} className="text-[#5865F2]" />
                </div>
                <div>
                  <p className="text-sm font-medium">Discord</p>
                  {discord.discordInfo ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Connected as {discord.discordInfo.username}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500">Not connected</p>
                  )}
                </div>
              </div>
              {discord.discordInfo ? (
                <button
                  onClick={discord.disconnect}
                  disabled={discord.disconnecting}
                  className="text-xs text-neutral-500 transition-colors hover:text-red-500 disabled:opacity-50"
                >
                  {discord.disconnecting ? "…" : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={discord.connect}
                  disabled={discord.connecting}
                  className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-500 disabled:opacity-50 dark:text-emerald-400"
                >
                  {discord.connecting ? "…" : "Connect"}
                </button>
              )}
            </div>
          </div>
          {(github.error || discord.error) ? (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">
              {github.error || discord.error}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default function SummerCohortPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-neutral-500 md:px-6 md:py-14">
          Loading…
        </div>
      }
    >
      <SummerCohortPageInner />
    </Suspense>
  );
}
