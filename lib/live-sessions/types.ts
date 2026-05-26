/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const LIVE_TALK_DURATIONS = [3, 5] as const;

export type LiveTalkDurationMinutes = (typeof LIVE_TALK_DURATIONS)[number];

/** @internal */
export type LiveSessionStatus = "pending" | "live" | "completed" | "cancelled";
/** @internal */
export type LiveTimerStatus = "idle" | "running" | "paused" | "completed";
/** @internal */
export type LiveQueueEntryStatus = "queued" | "live" | "completed" | "skipped" | "removed";
export type LiveSessionControlAction =
  | "start-next"
  | "pause-timer"
  | "resume-timer"
  | "complete-current"
  | "skip-current"
  | "remove-entry"
  | "move-entry"
  | "end-session";

/** @internal */
export interface LiveSessionTimerState {
  status: LiveTimerStatus;
  durationSeconds: number;
  remainingSeconds: number;
  startedAtMs: number | null;
  pausedAtMs: number | null;
  warningThresholds: number[];
}

/** @internal */
export interface LiveSessionCurrentSpeaker {
  entryId: string | null;
  speakerName: string | null;
  talkTitle: string | null;
}

/** @internal */
export interface LiveSessionRealtimeRecord {
  id: string;
  status: LiveSessionStatus;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  emceeUid: string;
  emceeName: string;
  audiencePath: string;
  emceePath: string;
  currentSpeaker: LiveSessionCurrentSpeaker;
  timer: LiveSessionTimerState;
  history: LiveSessionHistoryRecord[];
}

/** @internal */
export interface LiveSessionArchiveRecord {
  sessionId: string;
  title: string;
  status: LiveSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    uid: string;
    name: string;
  };
  audiencePath: string;
  emceePath: string;
  history: LiveSessionHistoryRecord[];
}

/** @internal */
export interface LiveQueueEntryRecord {
  id: string;
  sessionId: string;
  userId: string;
  speakerName: string;
  speakerPhotoUrl: string | null;
  talkTitle: string;
  durationMinutes: LiveTalkDurationMinutes;
  status: LiveQueueEntryStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

/** @internal */
export interface CreateLiveSessionInput {
  title: string;
  emceeUid: string;
  emceeName: string;
}

/** @internal */
export interface CreatedLiveSession {
  sessionId: string;
  session: LiveSessionRealtimeRecord;
}

/** @internal */
export interface EnqueueSpeakerInput {
  sessionId: string;
  userId: string;
  speakerName: string;
  speakerPhotoUrl?: string | null;
  talkTitle: string;
  durationMinutes: LiveTalkDurationMinutes;
}

/** @internal */
export interface LiveSessionHistoryRecord {
  entryId: string;
  userId: string;
  speakerName: string;
  talkTitle: string;
  durationMinutes: LiveTalkDurationMinutes;
  outcome: Extract<LiveQueueEntryStatus, "completed" | "skipped" | "removed">;
  startedAtMs: number | null;
  finishedAtMs: number;
}

/** @internal */
export interface ControlLiveSessionInput {
  sessionId: string;
  emceeUid: string;
  action: LiveSessionControlAction;
  entryId?: string;
  targetIndex?: number;
}
