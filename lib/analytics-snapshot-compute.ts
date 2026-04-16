/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import showcaseData from "@/content/showcase.json";
import eventsData from "@/content/events.json";
import type { EventsData } from "@/types/events";

export const ANALYTICS_SNAPSHOT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const typedEvents = eventsData as unknown as EventsData;
const eventNameMap: Record<string, string> = {};
[
  ...typedEvents.upcoming,
  ...typedEvents.past,
  ...(typedEvents.oldEvents ?? []),
].forEach((event) => {
  if (event.id && event.title) {
    eventNameMap[event.id] = event.title;
  }
});

export interface AnalyticsSummary {
  totalMembers: number;
  totalEventRegistrations: number;
  totalShowcaseInteractions: number;
  totalShowcaseProjects: number;
  memberGrowth: { month: string; count: number }[];
  eventAttendance: { eventId: string; name: string; count: number }[];
  skillDistribution: { skill: string; count: number }[];
  hackathonStats: {
    teamsFormed: number;
    projectsSubmitted: number;
    teamsAsPercentOfMembers: number;
  };
  communityActivity: { week: string; posts: number; replies: number }[];
  platformHealth: { activeThisMonth: number; returningMembers: number };
  showcaseOverTime: { month: string; count: number }[];
  generatedAt: string;
}

export const EMPTY_ANALYTICS_SUMMARY: AnalyticsSummary = {
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

/**
 * Full Firestore scans — run only from cron/CLI (`/api/internal/snapshots/rebuild` or script), never from public GET /api/analytics/summary.
 */
export async function computeAnalyticsSummary(db: Firestore): Promise<AnalyticsSummary> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
    db      .collection("communityMessages")
      .where("createdAt", ">=", eightWeeksAgo)
      .orderBy("createdAt", "desc")
      .get(),
  ]);

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

  let totalShowcaseInteractions = 0;
  showcaseProjectsSnap.forEach((doc) => {
    const data = doc.data();
    totalShowcaseInteractions += Number(data.upCount || 0) + Number(data.downCount || 0);
  });

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

  const activeUserIds = new Set<string>();
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
  let returningMembers = 0;
  activeUserIds.forEach((uid) => {
    if (previouslyActiveUserIds.has(uid)) returningMembers++;
  });

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

  const weekData: Record<string, { posts: number; replies: number }> = {};
  communityMessagesSnap.forEach((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt;
    if (createdAt?.toDate) {
      const date = createdAt.toDate() as Date;
      const dayOfWeek = date.getUTCDay();
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      const weekStart = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday)
      );
      const key = weekStart.toISOString().slice(0, 10);
      if (!weekData[key]) weekData[key] = { posts: 0, replies: 0 };
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

  return {
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
      teamsAsPercentOfMembers:
        usersSnap.size > 0 ? Math.round((hackathonTeamsSnap.size * 100) / usersSnap.size) : 0,
    },
    communityActivity,
    platformHealth: { activeThisMonth: activeUserIds.size, returningMembers },
    showcaseOverTime,
    generatedAt: new Date().toISOString(),
  };
}
