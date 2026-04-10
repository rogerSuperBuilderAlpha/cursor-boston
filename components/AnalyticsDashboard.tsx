/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsSummary } from "@/app/api/analytics/summary/route";

// Count-up animation hook (setState only in rAF callback — never synchronously in effect body)
function useCountUp(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const animated = useCountUp(value);
  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold text-foreground mt-1">{animated.toLocaleString()}</p>
      </div>
    </div>
  );
}

function HealthCard({ label, value, note }: { label: string; value: number; note: string }) {
  const animated = useCountUp(value);
  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{animated.toLocaleString()}</p>
      <p className="text-xs text-neutral-400 mt-2">{note}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-6">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center text-neutral-400 text-sm text-center px-4">
      {message}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analytics/summary", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json() as Promise<AnalyticsSummary>;
      })
      .then((summary) => {
        setData(summary);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const isDark = resolvedTheme === "dark";
  const axisColor = isDark ? "#737373" : "#a3a3a3";
  const gridColor = isDark ? "#262626" : "#f5f5f5";
  const tooltipBg = isDark ? "#171717" : "#ffffff";
  const tooltipBorder = isDark ? "#404040" : "#e5e5e5";
  const tooltipLabelColor = isDark ? "#e5e5e5" : "#171717";

  if (loading) {
    return (
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (fetchError || !data) {
    return (
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-neutral-500 py-20">
            Analytics are unavailable right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: tooltipBg,
      border: `1px solid ${tooltipBorder}`,
      borderRadius: "8px",
      fontSize: "12px",
    },
    labelStyle: { color: tooltipLabelColor, fontWeight: 600 },
    itemStyle: { color: "#10b981" },
  };
  const barCursor = { fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" };

  return (
    <section className="py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Stat Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Members"
            value={data.totalMembers}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <StatCard
            label="Event Registrations"
            value={data.totalEventRegistrations}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
          />
          <StatCard
            label="Showcase Projects"
            value={data.totalShowcaseProjects}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            }
          />
          <StatCard
            label="Showcase Interactions"
            value={data.totalShowcaseInteractions}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            }
          />
        </div>

        {/* Platform Health */}
        <div className="grid sm:grid-cols-2 gap-4">
          <HealthCard
            label="Active Members This Month"
            value={data.platformHealth.activeThisMonth}
            note="Members active via events or community feed in the last 30 days"
          />
          <HealthCard
            label="Returning Members"
            value={data.platformHealth.returningMembers}
            note="Active this month who also had prior activity"
          />
        </div>

        {/* Hackathon Stats */}
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Hackathon Stats</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Teams Formed</p>
              <p className="text-3xl font-bold text-foreground">{data.hackathonStats.teamsFormed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Projects Submitted</p>
              <p className="text-3xl font-bold text-foreground">{data.hackathonStats.projectsSubmitted.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Teams as % of Members</p>
              <p className="text-3xl font-bold text-foreground">{data.hackathonStats.teamsAsPercentOfMembers}%</p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Member Growth */}
          <ChartCard title="Member Growth (Last 12 Months)">
            {data.memberGrowth.length === 0 ? (
              <EmptyChart message="No member growth data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.memberGrowth} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} activeDot={{ r: 5 }} name="New Members" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Event Attendance */}
          <ChartCard title="Top Events by Registrations">
            {data.eventAttendance.length === 0 ? (
              <EmptyChart message="No event registration data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.eventAttendance} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} cursor={barCursor} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Registrations" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Skill Distribution */}
          <ChartCard title="Top Skills in Community">
            {data.skillDistribution.length === 0 ? (
              <EmptyChart message="No skill data yet. Skills are sourced from pair programming profiles." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.skillDistribution} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="skill" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip {...tooltipStyle} cursor={barCursor} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Members" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Community Feed Activity */}
          <ChartCard title="Community Feed Activity (Last 8 Weeks)">
            {data.communityActivity.length === 0 ? (
              <EmptyChart message="No community feed activity data available yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.communityActivity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} cursor={barCursor} />
                  <Legend wrapperStyle={{ fontSize: "12px", color: axisColor }} />
                  <Bar dataKey="posts" fill="#10b981" radius={[0, 0, 0, 0]} name="Posts" stackId="a" />
                  <Bar dataKey="replies" fill="#34d399" radius={[4, 4, 0, 0]} name="Replies" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Showcase Submissions Over Time */}
          <ChartCard title="Showcase Submissions Over Time">
            {data.showcaseOverTime.length === 0 ? (
              <EmptyChart message="No showcase submissions yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.showcaseOverTime} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} cursor={barCursor} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

        </div>

        <p className="text-center text-xs text-neutral-400">
          Data cached hourly · Last updated: {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>
    </section>
  );
}
