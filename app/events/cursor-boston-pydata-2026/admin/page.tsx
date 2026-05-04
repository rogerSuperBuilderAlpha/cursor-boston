/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  PYDATA_2026_EVENT_SLUG,
  type PydataRegistration,
  type PydataRegistrationStatus,
} from "@/lib/pydata-2026";

const API_PATH = "/api/events/pydata-2026/admin/list";

const STATUS_LABEL: Record<PydataRegistrationStatus, string> = {
  "awaiting-badge": "Awaiting badge",
  "badge-ready": "Badge ready",
  "checked-in": "Checked in",
  cancelled: "Cancelled",
};

const STATUS_PILL: Record<PydataRegistrationStatus, string> = {
  "awaiting-badge":
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "badge-ready":
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "checked-in":
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled:
    "border-neutral-500/30 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
};

type Response = {
  total: number;
  counts: Partial<Record<PydataRegistrationStatus, number>>;
  registrations: PydataRegistration[];
};

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV format Jacqueline (Moderna PyData host) requires 48h before the event:
 * 4 columns, "Full name | Email | Phone | Company". First two mandatory, last
 * two optional. Order and column names matter — don't reshuffle without
 * checking with her first.
 */
function toModernaCsv(registrations: PydataRegistration[]): string {
  const header = ["Full name", "Email", "Phone", "Company"].join(",");
  const rows = registrations
    .filter((r) => r.status !== "cancelled")
    .map((r) =>
      [
        csvEscape(`${r.firstName} ${r.lastName}`.trim()),
        csvEscape(r.email),
        csvEscape(r.phone),
        csvEscape(r.organization),
      ].join(",")
    );
  return [header, ...rows].join("\n");
}

/** Internal CSV with everything — for our own bookkeeping. */
function toFullCsv(registrations: PydataRegistration[]): string {
  const header = [
    "First name",
    "Last name",
    "Email",
    "Phone",
    "Organization",
    "Status",
    "Confirmed at (ET)",
  ].join(",");
  const rows = registrations.map((r) =>
    [
      csvEscape(r.firstName),
      csvEscape(r.lastName),
      csvEscape(r.email),
      csvEscape(r.phone),
      csvEscape(r.organization),
      csvEscape(STATUS_LABEL[r.status]),
      csvEscape(formatDate(r.createdAt)),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export default function PyDataAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(API_PATH, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(json as Response);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch on auth resolution
    void load();
  }, [authLoading, user, load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.registrations;
    return data.registrations.filter((r) => {
      const haystack = `${r.firstName} ${r.lastName} ${r.email} ${r.phone} ${r.organization}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search]);

  const downloadFile = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const today = new Date().toISOString().slice(0, 10);

  const downloadModernaCsv = () => {
    if (!data) return;
    downloadFile(`pydata-2026-moderna-${today}.csv`, toModernaCsv(data.registrations));
  };

  const downloadFullCsv = () => {
    if (!data) return;
    downloadFile(`pydata-2026-full-${today}.csv`, toFullCsv(data.registrations));
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/events" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Events
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/events/${PYDATA_2026_EVENT_SLUG}`}
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            PyData × Cursor Boston
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">Admin</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              PyData × Cursor Boston — Registrations
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Anyone who has confirmed attendance via{" "}
              <code>/events/{PYDATA_2026_EVENT_SLUG}/register</code>. Hand this
              list to Moderna for badge issuance.
            </p>
          </div>
          {data ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-neutral-500">
                {lastRefresh ? `Updated ${lastRefresh}` : ""}
              </span>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={downloadModernaCsv}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400"
                title="4-column CSV (Full name, Email, Phone, Company) for Moderna's Envoy registration. Excludes cancelled."
              >
                CSV for Moderna
              </button>
              <button
                type="button"
                onClick={downloadFullCsv}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                title="Full export (status + timestamps) for our own records."
              >
                Full export
              </button>
            </div>
          ) : null}
        </div>

        {authLoading || loading ? (
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm text-neutral-500">Loading…</p>
          </div>
        ) : !user ? (
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-4 text-neutral-700 dark:text-neutral-300">
              Sign in as an admin to view the registration list.
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/events/${PYDATA_2026_EVENT_SLUG}/admin`)}`}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Sign in
            </Link>
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {error === "Forbidden"
                ? "Your account isn't an admin on this site. Ask in #cb-admin if this is wrong."
                : error}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/30"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total registered" value={data.total} />
              <Stat
                label="Awaiting badge"
                value={data.counts["awaiting-badge"] ?? 0}
              />
              <Stat label="Badge ready" value={data.counts["badge-ready"] ?? 0} />
              <Stat label="Checked in" value={data.counts["checked-in"] ?? 0} />
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <input
                type="search"
                placeholder="Search name, email, or organization…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              <span className="text-sm text-neutral-500">
                Showing {filtered.length} of {data.total}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-neutral-100 dark:bg-neutral-900/80">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Organization</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Confirmed (ET)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-neutral-500"
                      >
                        {data.total === 0
                          ? "No registrations yet."
                          : "No matches for that search."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr
                        key={r.uid}
                        className="border-t border-neutral-200 dark:border-neutral-800"
                      >
                        <td className="px-4 py-3">
                          {r.firstName} {r.lastName}
                        </td>
                        <td className="px-4 py-3 break-all">{r.email}</td>
                        <td className="px-4 py-3 tabular-nums">{r.phone || "—"}</td>
                        <td className="px-4 py-3">{r.organization || "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[r.status]}`}
                          >
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 tabular-nums">
                          {formatDate(r.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
