/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #151 — app/api/mentorship/profile/route.ts.
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/mentorship/profile/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/mentorship/data-server", () => ({
  getMentorshipProfileServer: jest.fn(),
  createOrUpdateMentorshipProfileServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;
const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeGetRequest() {
  return new NextRequest("http://localhost/api/mentorship/profile");
}

function makePostRequest(body: unknown, opts: { rawBody?: string } = {}) {
  return new NextRequest("http://localhost/api/mentorship/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body),
  });
}

const validProfile = {
  role: "mentor",
  expertise: ["TypeScript", "  React  "],
  learningGoals: ["growth"],
  preferredLanguages: ["en"],
  timezone: " America/New_York ",
  availability: [{ day: "monday", from: "09:00", to: "17:00" }],
  bio: "Hi there",
  maxMentees: 3,
  isActive: true,
};

describe("GET /api/mentorship/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with profile when one exists", async () => {
    const { getMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { getMentorshipProfileServer: jest.Mock };
    getMentorshipProfileServer.mockResolvedValueOnce({
      userId: "u1",
      role: "mentor",
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.profile).toEqual({ userId: "u1", role: "mentor" });
  });

  it("returns 200 with profile null when none exists", async () => {
    const { getMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { getMentorshipProfileServer: jest.Mock };
    getMentorshipProfileServer.mockResolvedValueOnce(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile).toBeNull();
  });

  it("returns 500 when the service throws", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { getMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { getMentorshipProfileServer: jest.Mock };
    getMentorshipProfileServer.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch profile");
    spy.mockRestore();
  });
});

describe("POST /api/mentorship/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    createOrUpdateMentorshipProfileServer.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest(validProfile));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const res = await POST(makePostRequest(undefined, { rawBody: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is missing/invalid", async () => {
    const { role: _omit, ...rest } = validProfile;
    const res = await POST(makePostRequest(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 when timezone is empty", async () => {
    const res = await POST(makePostRequest({ ...validProfile, timezone: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 and normalizes optional fields on happy path", async () => {
    const res = await POST(makePostRequest(validProfile));
    expect(res.status).toBe(200);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    expect(createOrUpdateMentorshipProfileServer).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        role: "mentor",
        expertise: ["TypeScript", "React"], // trimmed
        timezone: "America/New_York", // trimmed
        bio: "Hi there",
        maxMentees: 3,
        isActive: true,
      }),
    );
  });

  it("defaults isActive to true and maxMentees to undefined when omitted", async () => {
    const { isActive: _a, maxMentees: _m, ...body } = validProfile;
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(200);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    expect(createOrUpdateMentorshipProfileServer).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        isActive: true,
        maxMentees: undefined,
      }),
    );
  });

  it("respects isActive=false when explicitly set", async () => {
    const res = await POST(
      makePostRequest({ ...validProfile, isActive: false }),
    );
    expect(res.status).toBe(200);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    expect(createOrUpdateMentorshipProfileServer).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ isActive: false }),
    );
  });

  it("filters whitespace-only expertise entries and treats omitted arrays as empty", async () => {
    const body = {
      role: "mentee",
      expertise: ["  ", "valid"],
      // learningGoals omitted -> should default to []
      timezone: "UTC",
    };
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(200);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    expect(createOrUpdateMentorshipProfileServer).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        expertise: ["valid"],
        learningGoals: [],
        preferredLanguages: [],
      }),
    );
  });

  it("returns 200 and omits bio when not provided", async () => {
    const { bio: _omit, ...body } = validProfile;
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(200);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    const passedProfile = createOrUpdateMentorshipProfileServer.mock.calls[0][1];
    expect(passedProfile.bio).toBeUndefined();
  });

  it("defaults availability to [] when the field is omitted", async () => {
    const { availability: _omit, ...body } = validProfile;
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(200);
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    expect(createOrUpdateMentorshipProfileServer).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ availability: [] }),
    );
  });

  it("returns 500 when service throws", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { createOrUpdateMentorshipProfileServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { createOrUpdateMentorshipProfileServer: jest.Mock };
    createOrUpdateMentorshipProfileServer.mockRejectedValueOnce(
      new Error("db down"),
    );
    const res = await POST(makePostRequest(validProfile));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to update profile");
    spy.mockRestore();
  });
});
