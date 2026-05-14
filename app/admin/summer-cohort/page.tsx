/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUMMER_COHORTS,
  type SummerCohortId,
  type SummerCohortStatus,
} from "@/lib/summer-cohort";

type ApplicationRow = {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  cohorts: SummerCohortId[];
  status: SummerCohortStatus;
  isLocal: boolean | null;
  wantsToPresent: boolean | null;
  createdAt: number | null;
  updatedAt: number | null;
};

type ApplicationsResponse = {
  applications: ApplicationRow[];
  total: number;
};

type Bucket = Record<string, number>;
type NumericStats = {
  n: number;
  mean: number | null;
  min: number | null;
  max: number | null;
};
type LikertStats = NumericStats & { distribution: Record<string, number> };
type YesNo = { yes: number; no: number; blank: number };

type Aggregates = {
  total: number;
  cohortDistribution: Bucket;
  demographics: {
    age: NumericStats;
    gender: Bucket;
    englishProficiency: Bucket;
    highestDegree: Bucket;
    employmentStatus: Bucket;
    topCountriesOfResidence: Array<{ value: string; count: number }>;
    topCountriesOfBirth: Array<{ value: string; count: number }>;
  };
  programming: {
    yearsProgramming: Bucket;
    programmingLanguages: Bucket;
    priorEngineerEmployment: YesNo;
    priorEngineerYears: NumericStats;
    csCredential: Bucket;
  };
  aiTools: {
    firstAiYear: NumericStats;
    llmFrequency: Bucket;
    aiToolsUsed: Bucket;
    cursorExperience: Bucket;
    shippedWithAi: YesNo;
    hoursPerWeekAi: NumericStats;
  };
  platforms: {
    hoursPerWeekSocial: NumericStats;
    postedAsCreator: YesNo;
    gigPlatformWork: YesNo;
    algorithmUnderstanding: LikertStats;
  };
  baselines: {
    baselineEffective: LikertStats;
    baselineUnderstanding: LikertStats;
  };
};

type VotesResponse = {
  weekId: string;
  counts: Record<string, number>;
};

const STATUS_FILTERS: Array<SummerCohortStatus | "all"> = [
  "all",
  "pending",
  "admitted",
  "waitlist",
  "rejected",
];

const VOTE_WEEKS: Array<"week-1" | "week-2" | "week-3"> = [
  "week-1",
  "week-2",
  "week-3",
];

// Today's cohort: whichever cohort end-of-program is still in the future,
// else the last one. Today is 2026-05-09 → cohort-1.
function defaultCohortId(now: number = Date.now()): SummerCohortId {
  for (const c of SUMMER_COHORTS) {
    const end = new Date(`${c.end}T23:59:59-04:00`).getTime();
    if (end >= now) return c.id;
  }
  return SUMMER_COHORTS[SUMMER_COHORTS.length - 1].id;
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: SummerCohortStatus): string {
  switch (status) {
    case "admitted":
      return "bg-emerald-900/60 text-emerald-100 border-emerald-700/50";
    case "rejected":
      return "bg-red-900/60 text-red-100 border-red-700/50";
    case "waitlist":
      return "bg-amber-900/60 text-amber-100 border-amber-700/50";
    case "pending":
    default:
      return "bg-zinc-800 text-zinc-200 border-zinc-700";
  }
}

function BucketBars({
  bucket,
  total,
}: {
  bucket: Bucket;
  total: number;
}) {
  const entries = Object.entries(bucket).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="text-xs text-zinc-500">No responses.</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map(([label, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={label} className="text-xs">
            <div className="flex justify-between text-zinc-300">
              <span className="truncate pr-2">{label}</span>
              <span className="text-zinc-500 tabular-nums">
                {count} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full bg-emerald-600/60"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NumericStatsLine({ stats }: { stats: NumericStats }) {
  if (stats.n === 0) {
    return <p className="text-xs text-zinc-500">No responses.</p>;
  }
  return (
    <p className="text-xs text-zinc-300">
      <span className="text-zinc-100 font-medium">mean {stats.mean}</span>
      <span className="text-zinc-500">
        {" "}
        · n={stats.n} · range {stats.min}–{stats.max}
      </span>
    </p>
  );
}

function LikertBars({ stats }: { stats: LikertStats }) {
  if (stats.n === 0) {
    return <p className="text-xs text-zinc-500">No responses.</p>;
  }
  const max = Math.max(...Object.values(stats.distribution), 1);
  return (
    <div>
      <p className="text-xs text-zinc-300 mb-1">
        <span className="text-zinc-100 font-medium">mean {stats.mean}</span>
        <span className="text-zinc-500"> · n={stats.n}</span>
      </p>
      <div className="flex items-end gap-1 h-12">
        {[1, 2, 3, 4, 5, 6, 7].map((bin) => {
          const count = stats.distribution[String(bin)] ?? 0;
          const pct = (count / max) * 100;
          return (
            <div key={bin} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full bg-emerald-600/60 rounded-sm"
                style={{ height: `${pct}%`, minHeight: count > 0 ? 2 : 0 }}
                title={`${bin}: ${count}`}
              />
              <span className="text-[10px] text-zinc-500">{bin}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YesNoLine({ yn }: { yn: YesNo }) {
  const total = yn.yes + yn.no + yn.blank;
  if (total === 0) {
    return <p className="text-xs text-zinc-500">No responses.</p>;
  }
  return (
    <p className="text-xs text-zinc-300 tabular-nums">
      <span className="text-emerald-400">yes {yn.yes}</span>
      <span className="text-zinc-500"> · </span>
      <span className="text-zinc-300">no {yn.no}</span>
      {yn.blank > 0 && (
        <>
          <span className="text-zinc-500"> · </span>
          <span className="text-zinc-500">blank {yn.blank}</span>
        </>
      )}
    </p>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function SummerCohortAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Access for this page is gated by the SUMMER_COHORT_ADMIN_EMAILS env var
  // (Vercel-managed), NOT the general isAdmin claim. Probe it on mount.
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const [cohortId, setCohortId] = useState<SummerCohortId>(defaultCohortId());
  const [statusFilter, setStatusFilter] = useState<SummerCohortStatus | "all">(
    "all"
  );

  const [apps, setApps] = useState<ApplicationRow[] | null>(null);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);

  const [aggs, setAggs] = useState<Aggregates | null>(null);
  const [aggsError, setAggsError] = useState<string | null>(null);
  const [aggsLoading, setAggsLoading] = useState(false);

  const [votes, setVotes] = useState<Record<string, VotesResponse | null>>({});
  const [votesError, setVotesError] = useState<string | null>(null);
  const [votesLoading, setVotesLoading] = useState(false);

  const fetchApps = useCallback(async () => {
    if (!user) return;
    setAppsLoading(true);
    setAppsError(null);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ cohortId });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(
        `/api/summer-cohort/admin/applications?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApplicationsResponse;
      setApps(data.applications);
    } catch (err) {
      setAppsError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setAppsLoading(false);
    }
  }, [user, cohortId, statusFilter]);

  const fetchAggs = useCallback(async () => {
    if (!user) return;
    setAggsLoading(true);
    setAggsError(null);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ cohort: cohortId });
      const res = await fetch(
        `/api/summer-cohort/admin/intake-aggregates?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Aggregates;
      setAggs(data);
    } catch (err) {
      setAggsError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setAggsLoading(false);
    }
  }, [user, cohortId]);

  const fetchVotes = useCallback(async () => {
    setVotesLoading(true);
    setVotesError(null);
    try {
      const results = await Promise.all(
        VOTE_WEEKS.map(async (weekId) => {
          const res = await fetch(
            `/api/summer-cohort/votes?weekId=${weekId}`
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          return [weekId, (await res.json()) as VotesResponse] as const;
        })
      );
      const next: Record<string, VotesResponse> = {};
      for (const [k, v] of results) next[k] = v;
      setVotes(next);
    } catch (err) {
      setVotesError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setVotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/summer-cohort/admin/access", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) as {
          allowed?: boolean;
        };
        if (cancelled) return;
        if (!res.ok || !data.allowed) {
          router.push("/");
          return;
        }
        setAccessAllowed(true);
        setAccessChecked(true);
        void fetchApps();
        void fetchAggs();
        void fetchVotes();
      } catch {
        if (!cancelled) router.push("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router, fetchApps, fetchAggs, fetchVotes]);

  const summary = useMemo(() => {
    if (!apps) return null;
    let pending = 0;
    let admitted = 0;
    let waitlist = 0;
    let rejected = 0;
    let isLocal = 0;
    let wantsToPresent = 0;
    for (const a of apps) {
      if (a.status === "pending") pending += 1;
      else if (a.status === "admitted") admitted += 1;
      else if (a.status === "waitlist") waitlist += 1;
      else if (a.status === "rejected") rejected += 1;
      if (a.isLocal === true) isLocal += 1;
      if (a.wantsToPresent === true) wantsToPresent += 1;
    }
    return {
      total: apps.length,
      pending,
      admitted,
      waitlist,
      rejected,
      isLocal,
      wantsToPresent,
    };
  }, [apps]);

  const activeMembers = useMemo(
    () =>
      apps
        ? apps
            .filter((a) => a.status === "admitted")
            .sort((a, b) =>
              (a.name ?? "").localeCompare(b.name ?? "", undefined, {
                sensitivity: "base",
              })
            )
        : [],
    [apps]
  );

  if (loading || !accessChecked) {
    return <p className="text-zinc-400">Loading…</p>;
  }
  if (!user || !accessAllowed) return null;

  const cohortLabel =
    SUMMER_COHORTS.find((c) => c.id === cohortId)?.label ?? cohortId;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Summer cohort</h1>
          <p className="text-sm text-zinc-400">
            Applications, active members, intake-survey aggregates, and weekly
            votes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">Cohort</label>
          <select
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value as SummerCohortId)}
            className="bg-zinc-900 border border-zinc-700 text-white rounded px-2 py-1 text-sm"
          >
            {SUMMER_COHORTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.startLabel} – {c.endLabel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary stats */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
          {cohortLabel} · application summary
        </h2>
        {appsError && (
          <div className="rounded border border-red-700/50 bg-red-950/40 p-3 text-sm text-red-300 mb-3">
            {appsError}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {summary ? (
            [
              ["Total", summary.total, "text-white"],
              ["Pending", summary.pending, "text-zinc-200"],
              ["Admitted", summary.admitted, "text-emerald-400"],
              ["Waitlist", summary.waitlist, "text-amber-300"],
              ["Rejected", summary.rejected, "text-red-300"],
              ["Local", summary.isLocal, "text-zinc-200"],
              ["Wants to present", summary.wantsToPresent, "text-zinc-200"],
            ].map(([label, value, color]) => (
              <div
                key={label as string}
                className="rounded border border-zinc-800 bg-zinc-900/50 p-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
                <p className={`text-xl font-semibold tabular-nums ${color}`}>
                  {value}
                </p>
              </div>
            ))
          ) : appsLoading ? (
            <p className="text-zinc-500 text-sm col-span-full">Loading…</p>
          ) : null}
        </div>
      </section>

      {/* Active members */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Active members · admitted in {cohortLabel}
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {activeMembers.length}
          </span>
        </div>
        {activeMembers.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No admitted members for {cohortLabel} yet.
          </p>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-sm">
              {activeMembers.map((m) => (
                <li key={m.userId} className="text-zinc-200 truncate">
                  {m.name ?? "(no name)"}
                  <span className="text-zinc-500"> · {m.email ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Applications table */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Applications
          </h2>
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded text-xs border ${
                  statusFilter === s
                    ? "bg-zinc-700 text-white border-zinc-600"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void fetchApps()}
              disabled={appsLoading}
              className="ml-2 px-2.5 py-1 rounded text-xs border bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 disabled:opacity-50"
            >
              {appsLoading ? "…" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Cohorts</th>
                  <th className="text-left px-3 py-2 font-medium">Local</th>
                  <th className="text-left px-3 py-2 font-medium">Present</th>
                  <th className="text-left px-3 py-2 font-medium">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {apps && apps.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-sm text-zinc-500"
                    >
                      No applications match these filters.
                    </td>
                  </tr>
                )}
                {apps?.map((a) => (
                  <tr key={a.userId} className="hover:bg-zinc-900">
                    <td className="px-3 py-2 text-zinc-100">
                      {a.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {a.email ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs border ${statusBadgeClass(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {a.cohorts.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {a.isLocal === true
                        ? "yes"
                        : a.isLocal === false
                          ? "no"
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {a.wantsToPresent === true
                        ? "yes"
                        : a.wantsToPresent === false
                          ? "no"
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {formatDate(a.createdAt)}
                    </td>
                  </tr>
                ))}
                {!apps && appsLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-sm text-zinc-500"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Intake aggregates */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Intake survey · {cohortLabel} aggregates
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {aggs ? `${aggs.total} response${aggs.total === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        {aggsError && (
          <div className="rounded border border-red-700/50 bg-red-950/40 p-3 text-sm text-red-300 mb-3">
            {aggsError}
          </div>
        )}
        {!aggs && aggsLoading && (
          <p className="text-zinc-500 text-sm">Loading…</p>
        )}
        {aggs && aggs.total === 0 && (
          <p className="text-zinc-500 text-sm">
            No intake-survey responses for {cohortLabel} yet.
          </p>
        )}
        {aggs && aggs.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card title="Age">
              <NumericStatsLine stats={aggs.demographics.age} />
            </Card>
            <Card title="Gender">
              <BucketBars bucket={aggs.demographics.gender} total={aggs.total} />
            </Card>
            <Card title="English proficiency">
              <BucketBars
                bucket={aggs.demographics.englishProficiency}
                total={aggs.total}
              />
            </Card>
            <Card title="Highest degree">
              <BucketBars
                bucket={aggs.demographics.highestDegree}
                total={aggs.total}
              />
            </Card>
            <Card title="Employment status">
              <BucketBars
                bucket={aggs.demographics.employmentStatus}
                total={aggs.total}
              />
            </Card>
            <Card title="Top countries (residence)">
              {aggs.demographics.topCountriesOfResidence.length === 0 ? (
                <p className="text-xs text-zinc-500">No responses.</p>
              ) : (
                <ul className="text-xs text-zinc-300 space-y-0.5">
                  {aggs.demographics.topCountriesOfResidence.map((c) => (
                    <li key={c.value} className="flex justify-between">
                      <span className="truncate pr-2">{c.value}</span>
                      <span className="tabular-nums text-zinc-500">
                        {c.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Years programming">
              <BucketBars
                bucket={aggs.programming.yearsProgramming}
                total={aggs.total}
              />
            </Card>
            <Card title="Programming languages (multi-select)">
              <BucketBars
                bucket={aggs.programming.programmingLanguages}
                total={aggs.total}
              />
            </Card>
            <Card title="CS credential">
              <BucketBars
                bucket={aggs.programming.csCredential}
                total={aggs.total}
              />
            </Card>
            <Card title="Prior engineering employment">
              <YesNoLine yn={aggs.programming.priorEngineerEmployment} />
            </Card>
            <Card title="Prior engineering years">
              <NumericStatsLine stats={aggs.programming.priorEngineerYears} />
            </Card>

            <Card title="LLM frequency">
              <BucketBars
                bucket={aggs.aiTools.llmFrequency}
                total={aggs.total}
              />
            </Card>
            <Card title="AI tools used (multi-select)">
              <BucketBars
                bucket={aggs.aiTools.aiToolsUsed}
                total={aggs.total}
              />
            </Card>
            <Card title="Cursor experience">
              <BucketBars
                bucket={aggs.aiTools.cursorExperience}
                total={aggs.total}
              />
            </Card>
            <Card title="Shipped with AI">
              <YesNoLine yn={aggs.aiTools.shippedWithAi} />
            </Card>
            <Card title="Hours/week using AI">
              <NumericStatsLine stats={aggs.aiTools.hoursPerWeekAi} />
            </Card>
            <Card title="First-AI year">
              <NumericStatsLine stats={aggs.aiTools.firstAiYear} />
            </Card>

            <Card title="Hours/week social">
              <NumericStatsLine stats={aggs.platforms.hoursPerWeekSocial} />
            </Card>
            <Card title="Posted as creator">
              <YesNoLine yn={aggs.platforms.postedAsCreator} />
            </Card>
            <Card title="Gig platform work">
              <YesNoLine yn={aggs.platforms.gigPlatformWork} />
            </Card>
            <Card title="Algorithm understanding (1–7)">
              <LikertBars stats={aggs.platforms.algorithmUnderstanding} />
            </Card>

            <Card title="Baseline: effective with AI (1–7)">
              <LikertBars stats={aggs.baselines.baselineEffective} />
            </Card>
            <Card title="Baseline: AI understanding (1–7)">
              <LikertBars stats={aggs.baselines.baselineUnderstanding} />
            </Card>
          </div>
        )}
      </section>

      {/* Weekly votes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Weekly votes
          </h2>
          <button
            type="button"
            onClick={() => void fetchVotes()}
            disabled={votesLoading}
            className="px-2.5 py-1 rounded text-xs border bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 disabled:opacity-50"
          >
            {votesLoading ? "…" : "Refresh"}
          </button>
        </div>
        {votesError && (
          <div className="rounded border border-red-700/50 bg-red-950/40 p-3 text-sm text-red-300 mb-3">
            {votesError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {VOTE_WEEKS.map((weekId) => {
            const data = votes[weekId];
            const entries = data
              ? Object.entries(data.counts).sort((a, b) => b[1] - a[1])
              : [];
            const totalVotes = entries.reduce((sum, [, c]) => sum + c, 0);
            return (
              <div
                key={weekId}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">{weekId}</h3>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                  </span>
                </div>
                {!data && votesLoading ? (
                  <p className="text-xs text-zinc-500">Loading…</p>
                ) : entries.length === 0 ? (
                  <p className="text-xs text-zinc-500">No votes yet.</p>
                ) : (
                  <ol className="space-y-1 text-sm">
                    {entries.map(([handle, count], i) => (
                      <li
                        key={handle}
                        className="flex items-center justify-between"
                      >
                        <span className="text-zinc-200 truncate pr-2">
                          <span className="text-zinc-500 mr-2 tabular-nums">
                            {i + 1}.
                          </span>
                          {handle}
                        </span>
                        <span className="tabular-nums text-emerald-400">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
