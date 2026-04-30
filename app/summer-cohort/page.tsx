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
  SUMMER_COHORT_RETURN_TO,
  type SummerCohortId,
} from "@/lib/summer-cohort";
import { CohortProgramBreakdown } from "./_components/CohortProgramBreakdown";

interface ApplicationDto {
  userId: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  cohorts: SummerCohortId[];
  siteId: string | null;
  status: "pending" | "admitted" | "rejected" | "waitlist";
  createdAt: number | null;
  updatedAt: number | null;
}

const KICKOFF_NOTE =
  "First Zoom kickoffs: Cohort 1 on Mon May 11, Cohort 2 on Mon Jun 29. Watch your email and check back here for the meeting link and next steps.";

function CohortDatesList() {
  return (
    <ul className="space-y-2">
      {SUMMER_COHORTS.map((cohort) => (
        <li
          key={cohort.id}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-neutral-100 border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800"
        >
          <span className="text-sm font-semibold">{cohort.label}</span>
          <span className="text-xs text-neutral-600 dark:text-neutral-300">
            {cohort.startLabel} – {cohort.endLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

function scrollToConnections() {
  const el = document.getElementById("connections-heading");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface StatusPanelProps {
  application: ApplicationDto;
  cohortLabel: (id: SummerCohortId) => string;
  withdrawing: boolean;
  withdrawError: string | null;
  onWithdraw: () => void;
  needsDiscord: boolean;
}

function ApplicationStatusPanel({
  application,
  cohortLabel,
  withdrawing,
  withdrawError,
  onWithdraw,
  needsDiscord,
}: StatusPanelProps) {
  const status = application.status;
  const cohortText = application.cohorts.map(cohortLabel).join(" and ");

  const tone =
    status === "admitted"
      ? {
          panel:
            "rounded-xl border border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-700 dark:bg-emerald-950/40",
          badge: "bg-emerald-500 text-white",
          divider: "border-emerald-200 dark:border-emerald-900",
          label: "Status: Admitted",
          headline: `You're in! Welcome to ${cohortText || "the cohort"}.`,
          body:
            "Watch for a separate email with the Zoom kickoff link. Until then, get ready by skimming the program breakdown below.",
        }
      : status === "waitlist"
        ? {
            panel:
              "rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30",
            badge: "bg-amber-500 text-white",
            divider: "border-amber-200 dark:border-amber-900",
            label: "Status: Waitlist",
            headline: `You're on the waitlist for ${cohortText || "the cohort"}.`,
            body:
              "We'll let you know by email if a spot opens up. In the meantime, the program breakdown below is what you'd be joining.",
          }
        : status === "rejected"
          ? {
              panel:
                "rounded-xl border border-neutral-300 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-900/60",
              badge: "bg-neutral-500 text-white",
              divider: "border-neutral-200 dark:border-neutral-800",
              label: "Status: Not selected",
              headline: "We weren't able to fit you into this cohort round.",
              body: "Thanks for applying — we'd love for you to apply to a future cohort.",
            }
          : {
              panel:
                "rounded-xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30",
              badge: "bg-emerald-500 text-white",
              divider: "border-emerald-200 dark:border-emerald-900",
              label: "Status: Pending",
              headline: `We received your application for ${cohortText || "the cohort"}.`,
              body: "We'll review and follow up by email. " + KICKOFF_NOTE,
            };

  const showDiscordCallout = status === "admitted" && needsDiscord;

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

      {showDiscordCallout ? (
        <div className="mt-4 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Action needed:</strong> connect your Discord below so we can
          add you to the cohort channel.{" "}
          <button
            type="button"
            onClick={scrollToConnections}
            className="underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-700 dark:decoration-amber-300/60"
          >
            Jump to connections
          </button>
          .
        </div>
      ) : null}

      <div
        className={`mt-4 flex flex-wrap items-center gap-3 border-t pt-4 ${tone.divider}`}
      >
        <button
          type="button"
          onClick={onWithdraw}
          disabled={withdrawing}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/30"
        >
          {withdrawing ? "Withdrawing…" : "Withdraw application"}
        </button>
        {withdrawError ? (
          <span className="text-xs text-red-600 dark:text-red-400">
            {withdrawError}
          </span>
        ) : null}
      </div>
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
  const [appLoading, setAppLoading] = useState(false);
  const [appLoadError, setAppLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickedCohorts, setPickedCohorts] = useState<Set<SummerCohortId>>(
    new Set(SUMMER_COHORTS.map((c) => c.id))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

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
        const json = (await res.json()) as { application: ApplicationDto | null };
        if (!cancelled) setApplication(json.application);
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

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/summer-cohort/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), cohorts }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(typeof json.error === "string" ? json.error : "Submit failed.");
        return;
      }
      setApplication(json.application as ApplicationDto);
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
      ) : application ? (
        <>
          <ApplicationStatusPanel
            application={application}
            cohortLabel={cohortLabel}
            withdrawing={withdrawing}
            withdrawError={withdrawError}
            onWithdraw={withdraw}
            needsDiscord={!discord.discordInfo}
          />
          <CohortProgramBreakdown />
        </>
      ) : (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold">Apply</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Fill this out and we&apos;ll be in touch.
          </p>
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
            {submitError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </section>
      )}

      {/* Connections panel — visible whenever the user is signed in. */}
      {user ? (
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
