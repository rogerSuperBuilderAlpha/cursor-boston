/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export type PairRecordingDifficulty = "beginner" | "intermediate" | "advanced";

export type PairRecordingSessionType =
  | "teach-me"
  | "build-together"
  | "code-review"
  | "explore-topic";

export type PairRecordingConsentStatus = "approved-for-public-library";

export type PairRecordingStorageStatus = "metadata-only" | "video-ready";

export interface PairRecordingChapter {
  start: string;
  title: string;
  summary: string;
}

export interface PairRecordingResource {
  label: string;
  url: string;
}

export interface PairSessionRecording {
  id: string;
  title: string;
  summary: string;
  topic: string;
  difficulty: PairRecordingDifficulty;
  sessionType: PairRecordingSessionType;
  durationMinutes: number;
  recordedAt: string;
  publishedAt: string;
  participants: string[];
  consentStatus: PairRecordingConsentStatus;
  consentApprovedAt: string;
  storageStatus: PairRecordingStorageStatus;
  videoUrl?: string;
  cursorSkills: string[];
  chapters: PairRecordingChapter[];
  resources: PairRecordingResource[];
}

export const PAIR_SESSION_RECORDINGS: PairSessionRecording[] = [
  {
    id: "react-refactor-with-cursor",
    title: "React Refactor With Cursor",
    summary:
      "Two members turn a crowded dashboard component into smaller units while preserving behavior with focused tests.",
    topic: "React refactoring",
    difficulty: "intermediate",
    sessionType: "code-review",
    durationMinutes: 42,
    recordedAt: "2026-05-09",
    publishedAt: "2026-05-13",
    participants: ["Maya Chen", "Andre Lewis"],
    consentStatus: "approved-for-public-library",
    consentApprovedAt: "2026-05-12",
    storageStatus: "metadata-only",
    cursorSkills: [
      "Component boundary discovery",
      "Regression-test planning",
      "Diff review",
    ],
    chapters: [
      {
        start: "00:00",
        title: "Set the refactor target",
        summary:
          "The pair identifies props, side effects, and behaviors that must stay stable.",
      },
      {
        start: "08:40",
        title: "Ask Cursor for seams",
        summary:
          "They use multi-file context to propose extraction points and reject two overbroad abstractions.",
      },
      {
        start: "22:15",
        title: "Lock behavior with tests",
        summary:
          "The session adds focused tests before moving markup into smaller components.",
      },
      {
        start: "35:30",
        title: "Review the final diff",
        summary:
          "The pair compares the before and after paths and captures the review checklist.",
      },
    ],
    resources: [
      {
        label: "Pair programming matchmaker",
        url: "/pair",
      },
      {
        label: "Community showcase",
        url: "/showcase",
      },
    ],
  },
  {
    id: "full-stack-debugging-loop",
    title: "Full-Stack Debugging Loop",
    summary:
      "A backend/frontend pair traces a failing signup flow from network response to validation message.",
    topic: "Full-stack debugging",
    difficulty: "advanced",
    sessionType: "build-together",
    durationMinutes: 55,
    recordedAt: "2026-05-16",
    publishedAt: "2026-05-20",
    participants: ["Noah Patel", "Elena Rivera"],
    consentStatus: "approved-for-public-library",
    consentApprovedAt: "2026-05-19",
    storageStatus: "metadata-only",
    cursorSkills: [
      "Log triage",
      "Route contract tracing",
      "Failure-mode tests",
    ],
    chapters: [
      {
        start: "00:00",
        title: "Reproduce the failure",
        summary:
          "They capture the failing request, response body, and visible UI state.",
      },
      {
        start: "11:10",
        title: "Trace server validation",
        summary:
          "Cursor follows the route handler and schema path to find a mismatched error branch.",
      },
      {
        start: "28:45",
        title: "Patch and test the fix",
        summary:
          "The pair adds focused tests around the user-visible recovery path.",
      },
      {
        start: "46:20",
        title: "Write the handoff",
        summary:
          "They turn the debugging trail into a concise PR note and regression checklist.",
      },
    ],
    resources: [
      {
        label: "Community Q&A",
        url: "/questions",
      },
      {
        label: "PR Studio",
        url: "/pr-ideas",
      },
    ],
  },
  {
    id: "cursor-onboarding-prompt-stack",
    title: "Cursor Onboarding Prompt Stack",
    summary:
      "A mentor walks a new member through a reusable prompt stack for reading an unfamiliar Next.js app.",
    topic: "Cursor onboarding",
    difficulty: "beginner",
    sessionType: "teach-me",
    durationMinutes: 31,
    recordedAt: "2026-05-22",
    publishedAt: "2026-05-24",
    participants: ["Priya Shah", "Marcus Young"],
    consentStatus: "approved-for-public-library",
    consentApprovedAt: "2026-05-23",
    storageStatus: "metadata-only",
    cursorSkills: [
      "Repository orientation",
      "Prompt decomposition",
      "Context budgeting",
    ],
    chapters: [
      {
        start: "00:00",
        title: "Map the app surface",
        summary:
          "The pair scans routes, shared components, and data helpers before editing.",
      },
      {
        start: "07:25",
        title: "Build a reading prompt",
        summary:
          "They create a prompt that asks Cursor for ownership boundaries and risk areas.",
      },
      {
        start: "18:05",
        title: "Turn notes into tasks",
        summary:
          "The session converts orientation notes into small, testable contribution ideas.",
      },
      {
        start: "26:30",
        title: "Close with a checklist",
        summary:
          "They leave a checklist for the next member to repeat the onboarding flow.",
      },
    ],
    resources: [
      {
        label: "Mentorship",
        url: "/mentorship",
      },
      {
        label: "Cookbook",
        url: "/cookbook",
      },
    ],
  },
];

export function getPublishedPairRecordings(): PairSessionRecording[] {
  return PAIR_SESSION_RECORDINGS.filter(
    (recording) => recording.consentStatus === "approved-for-public-library",
  );
}

export function getPairRecordingById(id: string): PairSessionRecording | null {
  return getPublishedPairRecordings().find((recording) => recording.id === id) ?? null;
}

export function getPairRecordingIds(): string[] {
  return getPublishedPairRecordings().map((recording) => recording.id);
}

export function getPairRecordingTopics(): string[] {
  return Array.from(
    new Set(getPublishedPairRecordings().map((recording) => recording.topic)),
  ).sort((a, b) => a.localeCompare(b));
}

export function getPairRecordingDifficulties(): PairRecordingDifficulty[] {
  return ["beginner", "intermediate", "advanced"].filter((difficulty) =>
    getPublishedPairRecordings().some(
      (recording) => recording.difficulty === difficulty,
    ),
  ) as PairRecordingDifficulty[];
}

export function filterPairRecordings(filters: {
  topic?: string;
  difficulty?: string;
}): PairSessionRecording[] {
  return getPublishedPairRecordings().filter((recording) => {
    const matchesTopic = !filters.topic || recording.topic === filters.topic;
    const matchesDifficulty =
      !filters.difficulty || recording.difficulty === filters.difficulty;

    return matchesTopic && matchesDifficulty;
  });
}

export function formatPairRecordingDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${hours} hr`
    : `${hours} hr ${remainingMinutes} min`;
}
