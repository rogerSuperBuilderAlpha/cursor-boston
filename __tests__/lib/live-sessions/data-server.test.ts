/**
 * @jest-environment node
 */

import {
  controlLiveSessionServer,
  createLiveSessionServer,
  enqueueSpeakerServer,
  LiveSessionClosedError,
  LiveSessionDuplicateSpeakerError,
  LiveSessionInvalidActionError,
  LiveSessionNotFoundError,
  LiveSessionUnauthorizedError,
} from "@/lib/live-sessions/data-server";
import { getAdminDb, getAdminRtdb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
  getAdminRtdb: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetAdminRtdb = getAdminRtdb as jest.MockedFunction<typeof getAdminRtdb>;

describe("createLiveSessionServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates firestore archive and realtime session records", async () => {
    const setFirestore = jest.fn(async () => undefined);
    const setRtdb = jest.fn(async () => undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          id: "live-session-1",
          set: setFirestore,
        })),
      })),
    } as never);

    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn(() => ({
        set: setRtdb,
      })),
    } as never);

    const result = await createLiveSessionServer({
      title: "Cursor Boston Demo Night",
      emceeUid: "admin-1",
      emceeName: "Admin User",
    });

    expect(result.sessionId).toBe("live-session-1");
    expect(result.session).toEqual(
      expect.objectContaining({
        id: "live-session-1",
        title: "Cursor Boston Demo Night",
        status: "pending",
        emceeUid: "admin-1",
        emceeName: "Admin User",
        audiencePath: "/live/live-session-1",
        emceePath: "/live/live-session-1/emcee",
      })
    );

    expect(setFirestore).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "live-session-1",
        title: "Cursor Boston Demo Night",
        status: "pending",
        createdBy: {
          uid: "admin-1",
          name: "Admin User",
        },
      })
    );

    expect(setRtdb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "live-session-1",
        title: "Cursor Boston Demo Night",
      })
    );
    expect(setRtdb).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [],
        items: {},
      })
    );
  });

  it("fails if firestore or realtime database admin clients are unavailable", async () => {
    mockGetAdminDb.mockReturnValue(null);
    mockGetAdminRtdb.mockReturnValue(null);

    await expect(
      createLiveSessionServer({
        title: "Lightning Talks",
        emceeUid: "admin-1",
        emceeName: "Admin User",
      })
    ).rejects.toThrow("Firebase Admin is not fully initialized");
  });
});

describe("enqueueSpeakerServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("appends a queued speaker entry and persists an archive record", async () => {
    const queueSet = jest.fn(async () => undefined);
    const queueTransaction = jest.fn(async (updater: (value: unknown) => unknown) => {
      const nextValue = updater({
        order: [],
        items: {},
        updatedAtMs: 1,
      });
      return { committed: true, snapshot: { val: () => nextValue } };
    });
    const queueGet = jest.fn(async () => ({
      exists: () => true,
      val: () => ({ status: "pending" }),
    }));
    const queueRef = jest.fn((path: string) => {
      if (path === "live_sessions/session-1") {
        return { get: queueGet };
      }
      if (path === "live_queue_entries/session-1") {
        return { set: queueSet, transaction: queueTransaction };
      }
      throw new Error(`unexpected ref path: ${path}`);
    });
    const firestoreSet = jest.fn(async () => undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name !== "live_queue_entries") {
          throw new Error(`unexpected collection: ${name}`);
        }
        return {
          doc: jest.fn(() => ({
            id: "entry-1",
            set: firestoreSet,
          })),
        };
      }),
    } as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: queueRef,
    } as never);

    const result = await enqueueSpeakerServer({
      sessionId: "session-1",
      userId: "user-1",
      speakerName: "Queue User",
      talkTitle: "Realtime Demos",
      durationMinutes: 3,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: "entry-1",
        sessionId: "session-1",
        userId: "user-1",
        speakerName: "Queue User",
        talkTitle: "Realtime Demos",
        durationMinutes: 3,
        status: "queued",
      })
    );
    expect(queueTransaction).toHaveBeenCalled();
    expect(firestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "entry-1",
        sessionId: "session-1",
        userId: "user-1",
      })
    );
  });

  it("throws when the session does not exist", async () => {
    mockGetAdminDb.mockReturnValue({} as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn(() => ({
        get: jest.fn(async () => ({
          exists: () => false,
        })),
      })),
    } as never);

    await expect(
      enqueueSpeakerServer({
        sessionId: "missing",
        userId: "user-1",
        speakerName: "Queue User",
        talkTitle: "Realtime Demos",
        durationMinutes: 3,
      })
    ).rejects.toBeInstanceOf(LiveSessionNotFoundError);
  });

  it("throws when the session is closed", async () => {
    mockGetAdminDb.mockReturnValue({} as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn(() => ({
        get: jest.fn(async () => ({
          exists: () => true,
          val: () => ({ status: "completed" }),
        })),
      })),
    } as never);

    await expect(
      enqueueSpeakerServer({
        sessionId: "closed",
        userId: "user-1",
        speakerName: "Queue User",
        talkTitle: "Realtime Demos",
        durationMinutes: 3,
      })
    ).rejects.toBeInstanceOf(LiveSessionClosedError);
  });

  it("throws when the speaker is already queued", async () => {
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          id: "entry-1",
          set: jest.fn(async () => undefined),
        })),
      })),
    } as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn((path: string) => {
        if (path === "live_sessions/session-1") {
          return {
            get: jest.fn(async () => ({
              exists: () => true,
              val: () => ({ status: "pending" }),
            })),
          };
        }
        if (path === "live_queue_entries/session-1") {
          return {
            transaction: jest.fn(async () => ({ committed: false })),
          };
        }
        throw new Error(`unexpected ref path: ${path}`);
      }),
    } as never);

    await expect(
      enqueueSpeakerServer({
        sessionId: "session-1",
        userId: "user-1",
        speakerName: "Queue User",
        talkTitle: "Realtime Demos",
        durationMinutes: 3,
      })
    ).rejects.toBeInstanceOf(LiveSessionDuplicateSpeakerError);
  });
});

describe("controlLiveSessionServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts the next queued speaker", async () => {
    const sessionSet = jest.fn(async () => undefined);
    const queueSet = jest.fn(async () => undefined);
    const archiveGet = jest.fn(async () => ({
      exists: true,
      data: () => ({
        sessionId: "session-1",
        history: [],
      }),
    }));
    const archiveSet = jest.fn(async () => undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "live_sessions") {
          return {
            doc: jest.fn(() => ({
              get: archiveGet,
              set: archiveSet,
            })),
          };
        }
        return {
          doc: jest.fn(() => ({
            set: jest.fn(async () => undefined),
          })),
        };
      }),
    } as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn((path: string) => {
        if (path === "live_sessions/session-1") {
          return {
            get: jest.fn(async () => ({
              exists: () => true,
              val: () => ({
                emceeUid: "admin-1",
                status: "pending",
                timer: {
                  status: "idle",
                  durationSeconds: 0,
                  remainingSeconds: 0,
                  startedAtMs: null,
                  pausedAtMs: null,
                  warningThresholds: [60, 30],
                },
                currentSpeaker: {
                  entryId: null,
                  speakerName: null,
                  talkTitle: null,
                },
              }),
            })),
            set: sessionSet,
          };
        }
        if (path === "live_queue_entries/session-1") {
          return {
            get: jest.fn(async () => ({
              val: () => ({
                order: ["entry-1"],
                items: {
                  "entry-1": {
                    id: "entry-1",
                    sessionId: "session-1",
                    userId: "user-1",
                    speakerName: "Queue User",
                    speakerPhotoUrl: null,
                    talkTitle: "Realtime Demos",
                    durationMinutes: 3,
                    status: "queued",
                    createdAtMs: 1,
                    updatedAtMs: 1,
                  },
                },
                updatedAtMs: 1,
              }),
            })),
            set: queueSet,
          };
        }
        throw new Error(`unexpected ref path: ${path}`);
      }),
    } as never);

    const result = await controlLiveSessionServer({
      sessionId: "session-1",
      emceeUid: "admin-1",
      action: "start-next",
    });

    expect(result.session.status).toBe("live");
    expect(result.session.currentSpeaker.entryId).toBe("entry-1");
    expect(result.session.timer.status).toBe("running");
    expect(queueSet).toHaveBeenCalled();
  });

  it("completes the current speaker and appends history", async () => {
    const entrySet = jest.fn(async () => undefined);
    const archiveSet = jest.fn(async () => undefined);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "live_sessions") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn(async () => ({
                exists: true,
                data: () => ({ sessionId: "session-1", history: [] }),
              })),
              set: archiveSet,
            })),
          };
        }
        if (name === "live_queue_entries") {
          return {
            doc: jest.fn(() => ({
              set: entrySet,
            })),
          };
        }
        throw new Error(`unexpected collection: ${name}`);
      }),
    } as never);

    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn((path: string) => {
        if (path === "live_sessions/session-1") {
          return {
            get: jest.fn(async () => ({
              exists: () => true,
              val: () => ({
                emceeUid: "admin-1",
                status: "live",
                timer: {
                  status: "running",
                  durationSeconds: 180,
                  remainingSeconds: 120,
                  startedAtMs: 100,
                  pausedAtMs: null,
                  warningThresholds: [60, 30],
                },
                currentSpeaker: {
                  entryId: "entry-1",
                  speakerName: "Queue User",
                  talkTitle: "Realtime Demos",
                },
              }),
            })),
            set: jest.fn(async () => undefined),
          };
        }
        if (path === "live_queue_entries/session-1") {
          return {
            get: jest.fn(async () => ({
              val: () => ({
                order: ["entry-1"],
                items: {
                  "entry-1": {
                    id: "entry-1",
                    sessionId: "session-1",
                    userId: "user-1",
                    speakerName: "Queue User",
                    speakerPhotoUrl: null,
                    talkTitle: "Realtime Demos",
                    durationMinutes: 3,
                    status: "live",
                    createdAtMs: 1,
                    updatedAtMs: 1,
                  },
                },
                updatedAtMs: 1,
              }),
            })),
            set: jest.fn(async () => undefined),
          };
        }
        throw new Error(`unexpected ref path: ${path}`);
      }),
    } as never);

    const result = await controlLiveSessionServer({
      sessionId: "session-1",
      emceeUid: "admin-1",
      action: "complete-current",
    });

    expect(result.historyRecord?.outcome).toBe("completed");
    expect(result.session.currentSpeaker.entryId).toBeNull();
    expect(result.session.timer.status).toBe("idle");
    expect(archiveSet).toHaveBeenCalled();
    expect(entrySet).toHaveBeenCalled();
  });

  it("blocks non-emcee control", async () => {
    mockGetAdminDb.mockReturnValue({ collection: jest.fn() } as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn(() => ({
        get: jest.fn(async () => ({
          exists: () => true,
          val: () => ({
            emceeUid: "admin-1",
            timer: { status: "idle", durationSeconds: 0, remainingSeconds: 0, startedAtMs: null, pausedAtMs: null, warningThresholds: [60, 30] },
            currentSpeaker: { entryId: null, speakerName: null, talkTitle: null },
          }),
        })),
      })),
    } as never);

    await expect(
      controlLiveSessionServer({
        sessionId: "session-1",
        emceeUid: "admin-2",
        action: "start-next",
      })
    ).rejects.toBeInstanceOf(LiveSessionUnauthorizedError);
  });

  it("rejects invalid action states", async () => {
    mockGetAdminDb.mockReturnValue({ collection: jest.fn() } as never);
    mockGetAdminRtdb.mockReturnValue({
      ref: jest.fn((path: string) => {
        if (path === "live_sessions/session-1") {
          return {
            get: jest.fn(async () => ({
              exists: () => true,
              val: () => ({
                emceeUid: "admin-1",
                status: "pending",
                timer: { status: "idle", durationSeconds: 0, remainingSeconds: 0, startedAtMs: null, pausedAtMs: null, warningThresholds: [60, 30] },
                currentSpeaker: { entryId: null, speakerName: null, talkTitle: null },
              }),
            })),
          };
        }
        return {
          get: jest.fn(async () => ({
            val: () => ({ order: [], items: {}, updatedAtMs: 1 }),
          })),
        };
      }),
    } as never);

    await expect(
      controlLiveSessionServer({
        sessionId: "session-1",
        emceeUid: "admin-1",
        action: "pause-timer",
      })
    ).rejects.toBeInstanceOf(LiveSessionInvalidActionError);
  });
});
