/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb, getAdminRtdb } from "@/lib/firebase-admin";
import type {
  ControlLiveSessionInput,
  CreateLiveSessionInput,
  CreatedLiveSession,
  EnqueueSpeakerInput,
  LiveSessionArchiveRecord,
  LiveQueueEntryRecord,
  LiveSessionHistoryRecord,
  LiveSessionRealtimeRecord,
  LiveSessionStatus,
} from "./types";

const FIRESTORE_COLLECTIONS = {
  SESSIONS: "live_sessions",
  QUEUE_ENTRIES: "live_queue_entries",
} as const;

const RTDB_ROOTS = {
  SESSIONS: "live_sessions",
  QUEUE: "live_queue_entries",
} as const;

export function buildLiveSessionPaths(sessionId: string) {
  return {
    audiencePath: `/live/${sessionId}`,
    emceePath: `/live/${sessionId}/emcee`,
    sessionRtdbPath: `${RTDB_ROOTS.SESSIONS}/${sessionId}`,
    queueRtdbPath: `${RTDB_ROOTS.QUEUE}/${sessionId}`,
  };
}

export class LiveSessionNotFoundError extends Error {
  constructor() {
    super("Live session not found");
    this.name = "LiveSessionNotFoundError";
  }
}

export class LiveSessionClosedError extends Error {
  constructor() {
    super("Live session is not accepting speakers");
    this.name = "LiveSessionClosedError";
  }
}

export class LiveSessionDuplicateSpeakerError extends Error {
  constructor() {
    super("Speaker is already in the queue for this live session");
    this.name = "LiveSessionDuplicateSpeakerError";
  }
}

export class LiveSessionUnauthorizedError extends Error {
  constructor() {
    super("Only the emcee can control this live session");
    this.name = "LiveSessionUnauthorizedError";
  }
}

export class LiveSessionInvalidActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveSessionInvalidActionError";
  }
}

function buildInitialRealtimeRecord(
  sessionId: string,
  input: CreateLiveSessionInput,
  nowMs: number
): LiveSessionRealtimeRecord {
  const paths = buildLiveSessionPaths(sessionId);

  return {
    id: sessionId,
    status: "pending",
    title: input.title,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    emceeUid: input.emceeUid,
    emceeName: input.emceeName,
    audiencePath: paths.audiencePath,
    emceePath: paths.emceePath,
    currentSpeaker: {
      entryId: null,
      speakerName: null,
      talkTitle: null,
    },
    timer: {
      status: "idle",
      durationSeconds: 0,
      remainingSeconds: 0,
      startedAtMs: null,
      pausedAtMs: null,
      warningThresholds: [60, 30],
    },
    history: [],
  };
}

function buildArchiveRecord(
  sessionId: string,
  session: LiveSessionRealtimeRecord,
  createdAt: Date
): LiveSessionArchiveRecord {
  return {
    sessionId,
    title: session.title,
    status: session.status,
    createdAt,
    updatedAt: createdAt,
    createdBy: {
      uid: session.emceeUid,
      name: session.emceeName,
    },
    audiencePath: session.audiencePath,
    emceePath: session.emceePath,
    history: [],
  };
}

export async function createLiveSessionServer(
  input: CreateLiveSessionInput
): Promise<CreatedLiveSession> {
  const adminDb = getAdminDb();
  const adminRtdb = getAdminRtdb();

  if (!adminDb || !adminRtdb) {
    throw new Error("Firebase Admin is not fully initialized");
  }

  const sessionRef = adminDb.collection(FIRESTORE_COLLECTIONS.SESSIONS).doc();
  const sessionId = sessionRef.id;
  const now = new Date();
  const nowMs = now.getTime();
  const session = buildInitialRealtimeRecord(sessionId, input, nowMs);
  const archiveRecord = buildArchiveRecord(sessionId, session, now);
  const paths = buildLiveSessionPaths(sessionId);

  await Promise.all([
    sessionRef.set(archiveRecord),
    adminRtdb.ref(paths.sessionRtdbPath).set(session),
    adminRtdb.ref(paths.queueRtdbPath).set({
      order: [],
      items: {},
      updatedAtMs: nowMs,
    }),
  ]);

  return {
    sessionId,
    session,
  };
}

function buildQueueEntry(
  entryId: string,
  input: EnqueueSpeakerInput,
  nowMs: number
): LiveQueueEntryRecord {
  return {
    id: entryId,
    sessionId: input.sessionId,
    userId: input.userId,
    speakerName: input.speakerName,
    speakerPhotoUrl: input.speakerPhotoUrl ?? null,
    talkTitle: input.talkTitle,
    durationMinutes: input.durationMinutes,
    status: "queued",
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

export async function enqueueSpeakerServer(
  input: EnqueueSpeakerInput
): Promise<LiveQueueEntryRecord> {
  const adminDb = getAdminDb();
  const adminRtdb = getAdminRtdb();

  if (!adminDb || !adminRtdb) {
    throw new Error("Firebase Admin is not fully initialized");
  }

  const paths = buildLiveSessionPaths(input.sessionId);
  const sessionSnapshot = await adminRtdb.ref(paths.sessionRtdbPath).get();

  if (!sessionSnapshot.exists()) {
    throw new LiveSessionNotFoundError();
  }

  const session = sessionSnapshot.val() as LiveSessionRealtimeRecord;
  if (session.status === "completed" || session.status === "cancelled") {
    throw new LiveSessionClosedError();
  }

  const queueRootRef = adminRtdb.ref(paths.queueRtdbPath);
  const entryRef = adminDb.collection(FIRESTORE_COLLECTIONS.QUEUE_ENTRIES).doc();
  const entryId = entryRef.id;
  const now = new Date();
  const nowMs = now.getTime();
  const entry = buildQueueEntry(entryId, input, nowMs);

  const transactionResult = await queueRootRef.transaction((current) => {
    const order = Array.isArray(current?.order)
      ? current.order.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const items =
      current && typeof current.items === "object" && current.items !== null
        ? (current.items as Record<string, LiveQueueEntryRecord>)
        : {};

    const duplicate = Object.values(items).some(
      (value) => value?.userId === input.userId && ["queued", "live"].includes(value.status)
    );
    if (duplicate) {
      return;
    }

    return {
      order: [...order, entryId],
      items: {
        ...items,
        [entryId]: entry,
      },
      updatedAtMs: nowMs,
    };
  });

  if (!transactionResult.committed) {
    throw new LiveSessionDuplicateSpeakerError();
  }

  await entryRef.set({
    ...entry,
    createdAt: now,
    updatedAt: now,
  });

  return entry;
}

function assertEmcee(session: LiveSessionRealtimeRecord, emceeUid: string) {
  if (session.emceeUid !== emceeUid) {
    throw new LiveSessionUnauthorizedError();
  }
}

function cloneQueueState(current: unknown): {
  order: string[];
  items: Record<string, LiveQueueEntryRecord>;
  updatedAtMs: number;
} {
  if (!current || typeof current !== "object") {
    return { order: [], items: {}, updatedAtMs: 0 };
  }

  const record = current as {
    order?: unknown;
    items?: unknown;
    updatedAtMs?: unknown;
  };

  return {
    order: Array.isArray(record.order)
      ? record.order.filter((value): value is string => typeof value === "string")
      : [],
    items:
      record.items && typeof record.items === "object"
        ? ({ ...record.items } as Record<string, LiveQueueEntryRecord>)
        : {},
    updatedAtMs: typeof record.updatedAtMs === "number" ? record.updatedAtMs : 0,
  };
}

function buildHistoryRecord(
  entry: LiveQueueEntryRecord,
  outcome: "completed" | "skipped" | "removed",
  startedAtMs: number | null,
  finishedAtMs: number
): LiveSessionHistoryRecord {
  return {
    entryId: entry.id,
    userId: entry.userId,
    speakerName: entry.speakerName,
    talkTitle: entry.talkTitle,
    durationMinutes: entry.durationMinutes,
    outcome,
    startedAtMs,
    finishedAtMs,
  };
}

async function appendHistoryAndUpdateSessionArchive(
  sessionId: string,
  updates: Partial<LiveSessionArchiveRecord>,
  historyRecord?: LiveSessionHistoryRecord
) {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not fully initialized");
  }

  const sessionRef = adminDb.collection(FIRESTORE_COLLECTIONS.SESSIONS).doc(sessionId);
  const snapshot = await sessionRef.get();
  const existing = snapshot.exists ? (snapshot.data() as LiveSessionArchiveRecord) : null;

  await sessionRef.set(
    {
      ...(existing || {}),
      ...updates,
      updatedAt: new Date(),
      history: historyRecord ? [...(existing?.history || []), historyRecord] : existing?.history || [],
    },
    { merge: true }
  );
}

function setCurrentSpeakerFromEntry(
  session: LiveSessionRealtimeRecord,
  entry: LiveQueueEntryRecord | null,
  nowMs: number
): LiveSessionRealtimeRecord {
  if (!entry) {
    return {
      ...session,
      status: "pending",
      updatedAtMs: nowMs,
      currentSpeaker: {
        entryId: null,
        speakerName: null,
        talkTitle: null,
      },
      timer: {
        ...session.timer,
        status: "idle",
        durationSeconds: 0,
        remainingSeconds: 0,
        startedAtMs: null,
        pausedAtMs: null,
      },
    };
  }

  const durationSeconds = entry.durationMinutes * 60;

  return {
    ...session,
    status: "live",
    updatedAtMs: nowMs,
    currentSpeaker: {
      entryId: entry.id,
      speakerName: entry.speakerName,
      talkTitle: entry.talkTitle,
    },
    timer: {
      ...session.timer,
      status: "running",
      durationSeconds,
      remainingSeconds: durationSeconds,
      startedAtMs: nowMs,
      pausedAtMs: null,
    },
  };
}

export async function controlLiveSessionServer(input: ControlLiveSessionInput) {
  const adminDb = getAdminDb();
  const adminRtdb = getAdminRtdb();

  if (!adminDb || !adminRtdb) {
    throw new Error("Firebase Admin is not fully initialized");
  }

  const paths = buildLiveSessionPaths(input.sessionId);
  const sessionRef = adminRtdb.ref(paths.sessionRtdbPath);
  const queueRef = adminRtdb.ref(paths.queueRtdbPath);
  const nowMs = Date.now();

  const [sessionSnapshot, queueSnapshot] = await Promise.all([sessionRef.get(), queueRef.get()]);

  if (!sessionSnapshot.exists()) {
    throw new LiveSessionNotFoundError();
  }

  const session = sessionSnapshot.val() as LiveSessionRealtimeRecord;
  assertEmcee(session, input.emceeUid);
  const queueState = cloneQueueState(queueSnapshot.val());
  const currentEntryId = session.currentSpeaker.entryId;
  const currentEntry = currentEntryId ? queueState.items[currentEntryId] || null : null;

  let nextSession: LiveSessionRealtimeRecord = { ...session };
  const nextQueueState = {
    order: [...queueState.order],
    items: { ...queueState.items },
    updatedAtMs: nowMs,
  };
  let historyRecord: LiveSessionHistoryRecord | undefined;
  let archiveStatus: LiveSessionStatus | undefined;

  if (input.action === "start-next") {
    if (currentEntry && session.timer.status !== "completed" && session.timer.status !== "idle") {
      throw new LiveSessionInvalidActionError("Finish or skip the current speaker first.");
    }
    const nextEntryId = nextQueueState.order.find((entryId) => nextQueueState.items[entryId]?.status === "queued");
    const nextEntry = nextEntryId ? nextQueueState.items[nextEntryId] : null;
    if (!nextEntry) {
      throw new LiveSessionInvalidActionError("No queued speakers remain.");
    }
    nextQueueState.items[nextEntry.id] = { ...nextEntry, status: "live", updatedAtMs: nowMs };
    nextSession = setCurrentSpeakerFromEntry(session, nextQueueState.items[nextEntry.id], nowMs);
  } else if (input.action === "pause-timer") {
    if (session.timer.status !== "running") {
      throw new LiveSessionInvalidActionError("Timer is not running.");
    }
    const elapsedSeconds = session.timer.startedAtMs
      ? Math.max(0, Math.floor((nowMs - session.timer.startedAtMs) / 1000))
      : 0;
    nextSession = {
      ...session,
      updatedAtMs: nowMs,
      timer: {
        ...session.timer,
        status: "paused",
        remainingSeconds: Math.max(0, session.timer.remainingSeconds - elapsedSeconds),
        startedAtMs: null,
        pausedAtMs: nowMs,
      },
    };
  } else if (input.action === "resume-timer") {
    if (session.timer.status !== "paused") {
      throw new LiveSessionInvalidActionError("Timer is not paused.");
    }
    nextSession = {
      ...session,
      updatedAtMs: nowMs,
      timer: {
        ...session.timer,
        status: "running",
        startedAtMs: nowMs,
        pausedAtMs: null,
      },
    };
  } else if (input.action === "complete-current" || input.action === "skip-current") {
    if (!currentEntry) {
      throw new LiveSessionInvalidActionError("There is no active speaker.");
    }
    const outcome = input.action === "complete-current" ? "completed" : "skipped";
    nextQueueState.items[currentEntry.id] = {
      ...currentEntry,
      status: outcome,
      updatedAtMs: nowMs,
    };
    historyRecord = buildHistoryRecord(currentEntry, outcome, session.timer.startedAtMs, nowMs);
    nextSession = setCurrentSpeakerFromEntry(session, null, nowMs);
  } else if (input.action === "remove-entry") {
    if (!input.entryId || !nextQueueState.items[input.entryId]) {
      throw new LiveSessionInvalidActionError("Queue entry not found.");
    }
    const entry = nextQueueState.items[input.entryId];
    nextQueueState.items[input.entryId] = { ...entry, status: "removed", updatedAtMs: nowMs };
    nextQueueState.order = nextQueueState.order.filter((entryId) => entryId !== input.entryId);
    historyRecord = buildHistoryRecord(entry, "removed", null, nowMs);
  } else if (input.action === "move-entry") {
    if (!input.entryId || !nextQueueState.items[input.entryId]) {
      throw new LiveSessionInvalidActionError("Queue entry not found.");
    }
    if (typeof input.targetIndex !== "number" || input.targetIndex < 0 || input.targetIndex >= nextQueueState.order.length) {
      throw new LiveSessionInvalidActionError("Target index is invalid.");
    }
    nextQueueState.order = nextQueueState.order.filter((entryId) => entryId !== input.entryId);
    nextQueueState.order.splice(input.targetIndex, 0, input.entryId);
  } else if (input.action === "end-session") {
    nextSession = {
      ...session,
      status: "completed",
      updatedAtMs: nowMs,
      timer: {
        ...session.timer,
        status: "completed",
        remainingSeconds: 0,
        startedAtMs: null,
        pausedAtMs: null,
      },
    };
    archiveStatus = "completed";
  } else {
    throw new LiveSessionInvalidActionError("Unsupported action.");
  }

  if (historyRecord) {
    nextSession = {
      ...nextSession,
      history: [...(session.history || []), historyRecord],
    };
  }

  await Promise.all([
    sessionRef.set(nextSession),
    queueRef.set(nextQueueState),
    appendHistoryAndUpdateSessionArchive(
      input.sessionId,
      archiveStatus ? { status: archiveStatus } : { status: nextSession.status },
      historyRecord
    ),
    ...(historyRecord
      ? [
          adminDb
            .collection(FIRESTORE_COLLECTIONS.QUEUE_ENTRIES)
            .doc(historyRecord.entryId)
            .set(
              {
                status: historyRecord.outcome,
                updatedAt: new Date(),
              },
              { merge: true }
            ),
        ]
      : []),
  ]);

  return {
    session: nextSession,
    queue: nextQueueState,
    historyRecord: historyRecord || null,
  };
}
