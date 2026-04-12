/**
 * @jest-environment node
 */

import {
  CAFE_CURSOR_SESSIONS,
  getOrCreateSessions,
  getSessionsWithStatus,
  registerForSession,
  cancelRegistration,
  checkCoworkingEligibility,
  getUserProfileForRegistration,
} from "@/lib/coworking";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), seconds: 1000, nanoseconds: 0 })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
  },
  FieldValue: {
    delete: jest.fn(() => "__DELETE__"),
    serverTimestamp: jest.fn(() => "__SERVER_TIMESTAMP__"),
  },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("CAFE_CURSOR_SESSIONS", () => {
  it("defines three 2-hour sessions from 9am to 3pm", () => {
    expect(CAFE_CURSOR_SESSIONS).toHaveLength(3);
    expect(CAFE_CURSOR_SESSIONS[0].startTime).toBe("09:00");
    expect(CAFE_CURSOR_SESSIONS[0].endTime).toBe("11:00");
    expect(CAFE_CURSOR_SESSIONS[1].startTime).toBe("11:00");
    expect(CAFE_CURSOR_SESSIONS[1].endTime).toBe("13:00");
    expect(CAFE_CURSOR_SESSIONS[2].startTime).toBe("13:00");
    expect(CAFE_CURSOR_SESSIONS[2].endTime).toBe("15:00");
  });

  it("each session has maxSlots of 20", () => {
    for (const session of CAFE_CURSOR_SESSIONS) {
      expect(session.maxSlots).toBe(20);
    }
  });
});

// ---------------------------------------------------------------------------
// getOrCreateSessions
// ---------------------------------------------------------------------------

describe("getOrCreateSessions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(getOrCreateSessions("event-1")).rejects.toThrow("Firebase Admin not configured");
  });

  it("returns existing sessions sorted by startTime", async () => {
    const existingDocs = [
      { id: "s2", data: () => ({ eventId: "event-1", startTime: "11:00", endTime: "13:00", label: "Midday", maxSlots: 20 }) },
      { id: "s1", data: () => ({ eventId: "event-1", startTime: "09:00", endTime: "11:00", label: "Morning", maxSlots: 20 }) },
    ];

    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({ empty: false, docs: existingDocs })),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const sessions = await getOrCreateSessions("event-1");
    expect(sessions).toHaveLength(2);
    expect(sessions[0].startTime).toBe("09:00");
    expect(sessions[1].startTime).toBe("11:00");
  });

  it("creates sessions when none exist for event", async () => {
    const mockSet = jest.fn();
    const mockCommit = jest.fn(async () => {});
    let docIdCounter = 0;

    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({ empty: true, docs: [] })),
    }));
    const mockDocFn = jest.fn(() => ({ id: `auto-id-${docIdCounter++}` }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        where: mockWhere,
        doc: mockDocFn,
      })),
      batch: jest.fn(() => ({
        set: mockSet,
        commit: mockCommit,
      })),
    } as never);

    const sessions = await getOrCreateSessions("event-1");
    expect(sessions).toHaveLength(3);
    expect(mockSet).toHaveBeenCalledTimes(3);
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getSessionsWithStatus
// ---------------------------------------------------------------------------

describe("getSessionsWithStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(getSessionsWithStatus("event-1")).rejects.toThrow("Firebase Admin not configured");
  });

  it("returns slot status with available slots and attendees", async () => {
    const sessionDocs = [
      { id: "s1", data: () => ({ eventId: "event-1", startTime: "09:00", endTime: "11:00", label: "Morning", maxSlots: 20 }) },
    ];
    const registrationDocs = [
      { id: "r1", data: () => ({ eventId: "event-1", sessionId: "s1", userId: "user-1", userDisplayName: "Alice" }) },
      { id: "r2", data: () => ({ eventId: "event-1", sessionId: "s1", userId: "user-2", userDisplayName: "Bob" }) },
    ];

    // getOrCreateSessions call -> collection("coworkingSessions").where().get()
    // getSessionsWithStatus call -> collection("coworkingRegistrations").where().get()
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          where: jest.fn(() => ({
            get: jest.fn(async () => ({ empty: false, docs: sessionDocs })),
          })),
        };
      }
      if (name === "coworkingRegistrations") {
        return {
          where: jest.fn(() => ({
            get: jest.fn(async () => ({ docs: registrationDocs })),
          })),
        };
      }
      return {};
    });

    mockGetAdminDb.mockReturnValue({ collection: mockCollection } as never);

    const statuses = await getSessionsWithStatus("event-1", "user-1");
    expect(statuses).toHaveLength(1);
    expect(statuses[0].session.currentBookings).toBe(2);
    expect(statuses[0].availableSlots).toBe(18);
    expect(statuses[0].isUserRegistered).toBe(true);
    expect(statuses[0].userRegistrationId).toBe("r1");
    expect(statuses[0].attendees).toHaveLength(2);
  });

  it("reports isUserRegistered=false when userId is not provided", async () => {
    const sessionDocs = [
      { id: "s1", data: () => ({ eventId: "event-1", startTime: "09:00", endTime: "11:00", label: "Morning", maxSlots: 20 }) },
    ];

    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          where: jest.fn(() => ({
            get: jest.fn(async () => ({ empty: false, docs: sessionDocs })),
          })),
        };
      }
      return {
        where: jest.fn(() => ({
          get: jest.fn(async () => ({ docs: [] })),
        })),
      };
    });

    mockGetAdminDb.mockReturnValue({ collection: mockCollection } as never);

    const statuses = await getSessionsWithStatus("event-1");
    expect(statuses[0].isUserRegistered).toBe(false);
    expect(statuses[0].userRegistrationId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// registerForSession
// ---------------------------------------------------------------------------

describe("registerForSession", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(
      registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" })
    ).rejects.toThrow("Firebase Admin not configured");
  });

  it("returns error when session not found", async () => {
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: false })),
          })),
        };
      }
      return { where: jest.fn(() => ({ get: jest.fn(async () => ({ docs: [] })) })) };
    });

    mockGetAdminDb.mockReturnValue({ collection: mockCollection } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Session not found");
  });

  it("returns error when session belongs to a different event", async () => {
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ eventId: "other-event", maxSlots: 20 }),
            })),
          })),
        };
      }
      return { where: jest.fn(() => ({ get: jest.fn(async () => ({ docs: [] })) })) };
    });

    mockGetAdminDb.mockReturnValue({ collection: mockCollection } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Session does not belong to this event");
  });

  it("returns error when user already registered for this session", async () => {
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ eventId: "event-1", maxSlots: 20 }),
            })),
          })),
        };
      }
      if (name === "coworkingRegistrations") {
        return {
          doc: jest.fn(() => ({ id: "new-reg" })),
          where: jest.fn((field: string) => {
            if (field === "userId") {
              return {
                get: jest.fn(async () => ({
                  docs: [{ data: () => ({ eventId: "event-1", sessionId: "session-1" }) }],
                })),
              };
            }
            if (field === "sessionId") {
              return {
                get: jest.fn(async () => ({ size: 5, docs: [] })),
              };
            }
            return { get: jest.fn(async () => ({ docs: [] })) };
          }),
        };
      }
      return {};
    });

    mockGetAdminDb.mockReturnValue({
      collection: mockCollection,
      runTransaction: jest.fn(),
    } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("You are already registered for this session");
  });

  it("returns error when user registered for different session in same event", async () => {
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ eventId: "event-1", maxSlots: 20 }),
            })),
          })),
        };
      }
      if (name === "coworkingRegistrations") {
        return {
          doc: jest.fn(() => ({ id: "new-reg" })),
          where: jest.fn((field: string) => {
            if (field === "userId") {
              return {
                get: jest.fn(async () => ({
                  docs: [{ data: () => ({ eventId: "event-1", sessionId: "session-2" }) }],
                })),
              };
            }
            return { get: jest.fn(async () => ({ size: 0, docs: [] })) };
          }),
        };
      }
      return {};
    });

    mockGetAdminDb.mockReturnValue({
      collection: mockCollection,
      runTransaction: jest.fn(),
    } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already registered for another session");
  });

  it("returns error when session is full (pre-transaction check)", async () => {
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ eventId: "event-1", maxSlots: 2 }),
            })),
          })),
        };
      }
      if (name === "coworkingRegistrations") {
        return {
          doc: jest.fn(() => ({ id: "new-reg" })),
          where: jest.fn((field: string) => {
            if (field === "userId") {
              return {
                get: jest.fn(async () => ({ docs: [] })),
              };
            }
            if (field === "sessionId") {
              return {
                get: jest.fn(async () => ({ size: 2, docs: [] })),
              };
            }
            return { get: jest.fn(async () => ({ docs: [] })) };
          }),
        };
      }
      return {};
    });

    mockGetAdminDb.mockReturnValue({
      collection: mockCollection,
      runTransaction: jest.fn(),
    } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("This session is full");
  });

  it("successfully registers a user via transaction", async () => {
    const mockSet = jest.fn();
    const regDocRef = { id: "new-reg-id" };

    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ eventId: "event-1", maxSlots: 20 }),
            })),
          })),
        };
      }
      if (name === "coworkingRegistrations") {
        return {
          doc: jest.fn(() => regDocRef),
          where: jest.fn((field: string) => {
            if (field === "userId") {
              return { get: jest.fn(async () => ({ docs: [] })) };
            }
            if (field === "sessionId") {
              return { get: jest.fn(async () => ({ size: 5, docs: [] })) };
            }
            return { get: jest.fn(async () => ({ docs: [] })) };
          }),
        };
      }
      return {};
    });

    const mockRunTransaction = jest.fn(async (callback: (tx: Record<string, jest.Mock>) => unknown) => {
      const tx = {
        get: jest.fn(async () => ({ size: 5 })),
        set: mockSet,
      };
      return callback(tx);
    });

    mockGetAdminDb.mockReturnValue({
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", {
      displayName: "Alice",
      photoUrl: "https://example.com/photo.jpg",
      github: "alice",
    });

    expect(result.success).toBe(true);
    expect(result.registration).toBeDefined();
    expect(result.registration?.id).toBe("new-reg-id");
    expect(result.registration?.userDisplayName).toBe("Alice");
    expect(mockSet).toHaveBeenCalledWith(
      regDocRef,
      expect.objectContaining({
        eventId: "event-1",
        sessionId: "session-1",
        userId: "user-1",
        userDisplayName: "Alice",
        userPhotoUrl: "https://example.com/photo.jpg",
        userGithub: "alice",
      })
    );
  });

  it("returns generic error when transaction throws", async () => {
    const mockCollection = jest.fn((name: string) => {
      if (name === "coworkingSessions") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ eventId: "event-1", maxSlots: 20 }),
            })),
          })),
        };
      }
      if (name === "coworkingRegistrations") {
        return {
          doc: jest.fn(() => ({ id: "new-reg" })),
          where: jest.fn(() => ({
            get: jest.fn(async () => ({ docs: [], size: 0 })),
          })),
        };
      }
      return {};
    });

    mockGetAdminDb.mockReturnValue({
      collection: mockCollection,
      runTransaction: jest.fn(async () => { throw new Error("Firestore error"); }),
    } as never);

    const result = await registerForSession("event-1", "session-1", "user-1", { displayName: "Alice" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to register. Please try again.");
  });
});

// ---------------------------------------------------------------------------
// cancelRegistration
// ---------------------------------------------------------------------------

describe("cancelRegistration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(cancelRegistration("event-1", "user-1")).rejects.toThrow("Firebase Admin not configured");
  });

  it("returns error when no registration found", async () => {
    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({ docs: [] })),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const result = await cancelRegistration("event-1", "user-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("No registration found");
  });

  it("deletes registration and returns success", async () => {
    const mockDelete = jest.fn(async () => {});
    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({
        docs: [
          { data: () => ({ eventId: "event-1", sessionId: "s1" }), ref: { delete: mockDelete } },
          { data: () => ({ eventId: "event-2", sessionId: "s2" }), ref: { delete: jest.fn() } },
        ],
      })),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const result = await cancelRegistration("event-1", "user-1");
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("returns error when delete throws", async () => {
    const mockDelete = jest.fn(async () => { throw new Error("DB error"); });
    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({
        docs: [
          { data: () => ({ eventId: "event-1" }), ref: { delete: mockDelete } },
        ],
      })),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const result = await cancelRegistration("event-1", "user-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to cancel registration");
  });
});

// ---------------------------------------------------------------------------
// checkCoworkingEligibility
// ---------------------------------------------------------------------------

describe("checkCoworkingEligibility", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(checkCoworkingEligibility("user-1")).rejects.toThrow("Firebase Admin not configured");
  });

  it("returns ineligible when user does not exist", async () => {
    const mockGet = jest.fn(async () => ({ exists: false }));
    const mockDoc = jest.fn(() => ({ get: mockGet }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: mockDoc })),
    } as never);

    const result = await checkCoworkingEligibility("user-1");
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("complete your profile");
  });

  it("returns ineligible when profile is not public", async () => {
    const mockGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ visibility: { isPublic: false }, github: { login: "user1" } }),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await checkCoworkingEligibility("user-1");
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("public");
  });

  it("returns ineligible when github is not connected", async () => {
    const mockGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ visibility: { isPublic: true } }),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await checkCoworkingEligibility("user-1");
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("GitHub");
  });

  it("returns eligible when profile is public and github is connected", async () => {
    const mockGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ visibility: { isPublic: true }, github: { login: "user1" } }),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await checkCoworkingEligibility("user-1");
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getUserProfileForRegistration
// ---------------------------------------------------------------------------

describe("getUserProfileForRegistration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    const result = await getUserProfileForRegistration("user-1");
    expect(result).toBeNull();
  });

  it("returns null when user does not exist", async () => {
    const mockGet = jest.fn(async () => ({ exists: false }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await getUserProfileForRegistration("user-1");
    expect(result).toBeNull();
  });

  it("returns profile with displayName, photoUrl, and github login", async () => {
    const mockGet = jest.fn(async () => ({
      exists: true,
      data: () => ({
        displayName: "Alice",
        photoURL: "https://example.com/alice.jpg",
        github: { login: "alice" },
      }),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await getUserProfileForRegistration("user-1");
    expect(result).toEqual({
      displayName: "Alice",
      photoUrl: "https://example.com/alice.jpg",
      github: "alice",
    });
  });

  it("falls back to name field when displayName is missing", async () => {
    const mockGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ name: "Bob" }),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await getUserProfileForRegistration("user-1");
    expect(result?.displayName).toBe("Bob");
  });

  it("uses 'Anonymous' when neither displayName nor name exist", async () => {
    const mockGet = jest.fn(async () => ({
      exists: true,
      data: () => ({}),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({ get: mockGet })) })),
    } as never);

    const result = await getUserProfileForRegistration("user-1");
    expect(result?.displayName).toBe("Anonymous");
  });
});
