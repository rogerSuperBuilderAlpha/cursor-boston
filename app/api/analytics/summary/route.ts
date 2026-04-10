/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import showcaseData from "@/content/showcase.json";
import eventsData from "@/content/events.json";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Build a lookup map from eventId → event title using the static events JSON
const eventNameMap: Record<string, string> = {};
[
  ...(eventsData.upcoming ?? []),
  ...(eventsData.past ?? []),
].forEach((event: { id?: string; title?: string }) => {
  if (event.id && event.title) {
    eventNameMap[event.id] = event.title;
  }
});

export interface AnalyticsSummary {
  totalMembers: number;
  totalEventRegistrations: number;
  // Total interactions (upvotes + downvotes) across all showcase projects
  totalShowcaseInteractions: number;
  totalShowcaseProjects: number;
  memberGrowth: { month: string; count: number }[];
  eventAttendance: { eventId: string; name: string; count: number }[];
  skillDistribution: { skill: string; count: number }[];
  hackathonStats: {
    teamsFormed: number;
    projectsSubmitted: number;
    // Teams formed as a percentage of total members — not individual participation rate
    teamsAsPercentOfMembers: number;
  };
  communityActivity: { week: string; posts: number; replies: number }[];
  platformHealth: { activeThisMonth: number; returningMembers: number };
  showcaseOverTime: { month: string; count: number }[];
  generatedAt: string;
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalMembers: 0,
  totalEventRegistrations: 0,
  totalShowcaseInteractions: 0,
  totalShowcaseProjects: 0,
  memberGrowth: [],
  eventAttendance: [],
  skillDistribution: [],
  hackathonStats: { teamsFormed: 0, projectsSubmitted: 0, teamsAsPercentOfMembers: 0 },
  communityActivity: [],
  platformHealth: { activeThisMonth: 0, returningMembers: 0 },
  showcaseOverTime: [],
  generatedAt: new Date().toISOString(),
};

export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rateResult = checkRateLimit(`analytics-summary:${clientId}`, RATE_LIMIT);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
    );
  }

  let db;
  try {
    db = getAdminDb();
  } catch (initError) {
    logger.logError(initError, { endpoint: "/api/analytics/summary", phase: "init" });
    return NextResponse.json({ ...EMPTY_SUMMARY, generatedAt: new Date().toISOString() });
  }

  if (!db) {
    return NextResponse.json({ ...EMPTY_SUMMARY, generatedAt: new Date().toISOString() });
  }

  try {
    // --- Check analytics_snapshots cache (1-hour TTL) ---
    const cacheRef = db.collection("analytics_snapshots").doc("latest");
    try {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        const expiresAt = cached?.expiresAt?.toDate ? (cached.expiresAt.toDate() as Date) : null;
        if (expiresAt && expiresAt > new Date()) {
          return NextResponse.json(cached?.summary as AnalyticsSummary);
        }
      }
    } catch {
      // Cache read failure is non-fatal — fall through to compute fresh
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Scope community messages to last 8 weeks for a deterministic feed activity window
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const [
      usersSnap,
      eventRegsSnap,
      showcaseProjectsSnap,
      pairProfilesSnap,
      hackathonTeamsSnap,
      hackathonSubmissionsSnap,
      communityMessagesSnap,
    ] = await Promise.all([
      db.collection("users").get(),
      db.collection("eventRegistrations").get(),
      db.collection("showcaseProjects").get(),
      db.collection("pair_profiles").get(),
      db.collection("hackathonTeams").get(),
      db.collection("hackathonSubmissions").get(),
      db.collection("communityMessages")
        .where("createdAt", ">=", eightWeeksAgo)
        .orderBy("createdAt", "desc")
        .get(),
    ]);

    // --- Event attendance per event (top 10), with human-readable names ---
    const attendanceCounts: Record<string, number> = {};
    eventRegsSnap.forEach((doc) => {
      const eventId = doc.data().eventId as string | undefined;
      if (eventId) attendanceCounts[eventId] = (attendanceCounts[eventId] || 0) + 1;
    });
    const eventAttendance = Object.entries(attendanceCounts)
      .map(([eventId, count]) => ({
        eventId,
        name: eventNameMap[eventId] ?? eventId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Showcase interactions (upvotes + downvotes = total engagement) ---
    let totalShowcaseInteractions = 0;
    showcaseProjectsSnap.forEach((doc) => {
      const data = doc.data();
      totalShowcaseInteractions += Number(data.upCount || 0) + Number(data.downCount || 0);
    });

    // --- Member growth by month (last 12 months) ---
    const monthCounts: Record<string, number> = {};
    usersSnap.forEach((doc) => {
      const createdAt = doc.data().createdAt;
      if (createdAt?.toDate) {
        const date = createdAt.toDate() as Date;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      }
    });
    const memberGrowth = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    // --- Platform health ---
    // Active this month: users who registered for an event or posted in the last 30 days
    const activeUserIds = new Set<string>();
    // Previously active: users who had activity BEFORE the last 30 days
    const previouslyActiveUserIds = new Set<string>();
    eventRegsSnap.forEach((doc) => {
      const data = doc.data();
      const ts = data.registeredAt ?? data.createdAt;
      if (ts?.toDate && data.userId) {
        const date = ts.toDate() as Date;
        if (date >= thirtyDaysAgo) {
          activeUserIds.add(data.userId as string);
        } else {
          previouslyActiveUserIds.add(data.userId as string);
        }
      }
    });
    communityMessagesSnap.forEach((doc) => {
      const data = doc.data();
      if (data.createdAt?.toDate && data.userId) {
        const date = data.createdAt.toDate() as Date;
        if (date >= thirtyDaysAgo) {
          activeUserIds.add(data.userId as string);
        } else {
          previouslyActiveUserIds.add(data.userId as string);
        }
      }
    });
    // Returning members: active this month AND had prior activity
    let returningMembers = 0;
    activeUserIds.forEach((uid) => {
      if (previouslyActiveUserIds.has(uid)) returningMembers++;
    });

    // --- Skill distribution from pair profiles ---
    const skillCounts: Record<string, number> = {};
    pairProfilesSnap.forEach((doc) => {
      const data = doc.data();
      const teach = Array.isArray(data.skillsCanTeach) ? (data.skillsCanTeach as string[]) : [];
      const learn = Array.isArray(data.skillsWantToLearn) ? (data.skillsWantToLearn as string[]) : [];
      [...teach, ...learn].forEach((skill) => {
        const normalized = skill.trim().toLowerCase();
        if (normalized) skillCounts[normalized] = (skillCounts[normalized] || 0) + 1;
      });
    });
    const skillDistribution = Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // --- Community feed activity by week (last 8 weeks, posts vs replies) ---
    const weekData: Record<string, { posts: number; replies: number }> = {};
    communityMessagesSnap.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;
      if (createdAt?.toDate) {
        const date = createdAt.toDate() as Date;
        // Normalize to the Monday of this week in UTC so buckets align with calendar weeks
        const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const daysSinceMonday = (dayOfWeek + 6) % 7;
        const weekStart = new Date(Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate() - daysSinceMonday,
        ));
        const key = weekStart.toISOString().slice(0, 10);
        if (!weekData[key]) weekData[key] = { posts: 0, replies: 0 };
        // Replies have a parentId field; top-level messages do not
        if (data.parentId) {
          weekData[key].replies++;
        } else {
          weekData[key].posts++;
        }
      }
    });
    const communityActivity = Object.entries(weekData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, counts]) => ({ week, ...counts }));

    // --- Showcase submissions over time (from static JSON) ---
    const showcaseMonths: Record<string, number> = {};
    (showcaseData.projects as Array<{ submittedDate?: string }>).forEach((project) => {
      if (project.submittedDate) {
        const month = project.submittedDate.slice(0, 7);
        showcaseMonths[month] = (showcaseMonths[month] || 0) + 1;
      }
    });
    const showcaseOverTime = Object.entries(showcaseMonths)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const summary: AnalyticsSummary = {
      totalMembers: usersSnap.size,
      totalEventRegistrations: eventRegsSnap.size,
      totalShowcaseInteractions,
      totalShowcaseProjects: (showcaseData.projects as Array<unknown>).length,
      memberGrowth,
      eventAttendance,
      skillDistribution,
      hackathonStats: {
        teamsFormed: hackathonTeamsSnap.size,
        projectsSubmitted: hackathonSubmissionsSnap.size,
        teamsAsPercentOfMembers: usersSnap.size > 0
          ? Math.round((hackathonTeamsSnap.size * 100) / usersSnap.size)
          : 0,
      },
      communityActivity,
      platformHealth: { activeThisMonth: activeUserIds.size, returningMembers },
      showcaseOverTime,
      generatedAt: new Date().toISOString(),
    };

    // --- Write to analytics_snapshots cache (non-fatal) ---
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await cacheRef.set({ summary, expiresAt, updatedAt: new Date() });
    } catch {
      // Cache write failure is non-fatal
    }

    return NextResponse.json(summary);
  } catch (error) {
    logger.logError(error, { endpoint: "/api/analytics/summary" });
    // Return empty data rather than a 500 so the page still renders gracefully
    return NextResponse.json({ ...EMPTY_SUMMARY, generatedAt: new Date().toISOString() });
  }
}
