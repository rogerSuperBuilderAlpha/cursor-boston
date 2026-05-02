/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/summer-cohort/apply/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { sendEmail } from "@/lib/mailgun";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockOrderByGet = jest.fn();
const mockLumaDocGet = jest.fn().mockResolvedValue({ exists: false });
/** Per-cohort counts returned by the `.where().count().get()` aggregation. */
const cohortCountByQuery = new Map<string, number>();
const mockCountGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name === "hackathonLumaRegistrants") {
        return {
          doc: () => ({ get: mockLumaDocGet }),
          where: () => ({ get: jest.fn().mockResolvedValue({ docs: [] }) }),
        };
      }
      return {
        doc: () => ({ get: mockDocGet, set: mockDocSet }),
        orderBy: () => ({ get: mockOrderByGet }),
        where: (_field: string, _op: string, value: unknown) => ({
          count: () => ({
            get: () => mockCountGet(value),
          }),
        }),
      };
    },
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__SERVER_TS__" },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const baseUser: VerifiedUser = {
  uid: "user-123",
  email: "applicant@example.com",
  name: "Test Applicant",
};

function makePost(body: unknown, opts?: { rawString?: string }) {
  return new NextRequest("https://cursorboston.com/api/summer-cohort/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://cursorboston.com",
    },
    body: opts?.rawString ?? JSON.stringify(body),
  });
}

function makeGet() {
  return new NextRequest("https://cursorboston.com/api/summer-cohort/apply", {
    method: "GET",
    headers: { Origin: "https://cursorboston.com" },
  });
}

/** Minimum payload that satisfies every required field. Tests override fields
 *  by spreading on top. */
const validBody = {
  name: "x",
  phone: "1",
  cohorts: ["cohort-1"],
  isLocal: true,
  wantsToPresent: false,
};

describe("POST /api/summer-cohort/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cohortCountByQuery.clear();
    cohortCountByQuery.set("cohort-1", 17);
    cohortCountByQuery.set("cohort-2", 4);
    mockCountGet.mockImplementation(async (cohortId: string) => ({
      data: () => ({ count: cohortCountByQuery.get(cohortId) ?? 0 }),
    }));
    mockGetVerifiedUser.mockResolvedValue(baseUser);
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => ({
        userId: "user-123",
        email: "applicant@example.com",
        name: "Test Applicant",
        phone: "555-1234",
        cohorts: ["cohort-1"],
        siteId: "cursor-boston",
        status: "pending",
        isLocal: true,
        wantsToPresent: false,
      }),
    });
    mockOrderByGet.mockResolvedValue({ docs: [] });
    mockLumaDocGet.mockResolvedValue({ exists: false });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when token has no email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u", name: "x" });
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(makePost(null, { rawString: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePost({ ...validBody, name: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    const res = await POST(makePost({ ...validBody, phone: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when isLocal is missing", async () => {
    const { isLocal: _omit, ...without } = validBody;
    void _omit;
    const res = await POST(makePost(without));
    expect(res.status).toBe(400);
  });

  it("returns 400 when wantsToPresent is missing", async () => {
    const { wantsToPresent: _omit, ...without } = validBody;
    void _omit;
    const res = await POST(makePost(without));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no valid cohorts are selected", async () => {
    const res = await POST(makePost({ ...validBody, cohorts: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when cohorts contains only invalid ids", async () => {
    const res = await POST(
      makePost({ ...validBody, cohorts: ["cohort-99", "fake"] })
    );
    expect(res.status).toBe(400);
  });

  it("creates a new application and sends notification email on success", async () => {
    mockDocGet
      .mockResolvedValueOnce({ exists: false }) // existing.exists = false
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          userId: "user-123",
          email: "applicant@example.com",
          name: "Test Applicant",
          phone: "555-1234",
          cohorts: ["cohort-1", "cohort-2"],
          siteId: "cursor-boston",
          status: "pending",
          isLocal: true,
          wantsToPresent: true,
        }),
      });
    mockOrderByGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            name: "Test Applicant",
            email: "applicant@example.com",
            phone: "555-1234",
            cohorts: ["cohort-1", "cohort-2"],
            createdAt: { toMillis: () => Date.now() },
          }),
        },
      ],
    });

    const res = await POST(
      makePost({
        ...validBody,
        name: "Test Applicant",
        phone: "555-1234",
        cohorts: ["cohort-1", "cohort-2", "cohort-1"], // dedupe
        isLocal: true,
        wantsToPresent: true,
      })
    );
    expect(res.status).toBe(200);
    expect(mockDocSet).toHaveBeenCalled();
    const setCall = mockDocSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall).toMatchObject({ isLocal: true, wantsToPresent: true });
    // Wait a microtask so the fire-and-forget email has a chance to dispatch.
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("updates existing application without sending notification email", async () => {
    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => ({}) }) // already exists
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          userId: "user-123",
          email: "applicant@example.com",
          name: "Updated Name",
          phone: "555-9999",
          cohorts: ["cohort-2"],
          siteId: "cursor-boston",
          status: "pending",
          isLocal: false,
          wantsToPresent: false,
        }),
      });

    const res = await POST(
      makePost({
        ...validBody,
        name: "Updated Name",
        phone: "555-9999",
        cohorts: ["cohort-2"],
        isLocal: false,
        wantsToPresent: false,
      })
    );
    expect(res.status).toBe(200);
    expect(mockDocSet).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("GET /api/summer-cohort/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cohortCountByQuery.clear();
    cohortCountByQuery.set("cohort-1", 17);
    cohortCountByQuery.set("cohort-2", 4);
    mockCountGet.mockImplementation(async (cohortId: string) => ({
      data: () => ({ count: cohortCountByQuery.get(cohortId) ?? 0 }),
    }));
    mockGetVerifiedUser.mockResolvedValue(baseUser);
    mockLumaDocGet.mockResolvedValue({ exists: false });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns null application + RSVP status when no doc exists", async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application).toBeNull();
    expect(body.mayImmersionRsvped).toBe(false);
    expect(body.applicationCounts).toEqual({ "cohort-1": 17, "cohort-2": 4 });
  });

  it("returns serialized application with new fields and RSVP=false by default", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: "user-123",
        email: "applicant@example.com",
        name: "Test Applicant",
        phone: "555-1234",
        cohorts: ["cohort-1"],
        siteId: "cursor-boston",
        status: "pending",
        isLocal: true,
        wantsToPresent: false,
        createdAt: { toMillis: () => 1717000000000 },
      }),
    });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application).toMatchObject({
      userId: "user-123",
      email: "applicant@example.com",
      cohorts: ["cohort-1"],
      status: "pending",
      isLocal: true,
      wantsToPresent: false,
      mayImmersionRsvped: false,
      createdAt: 1717000000000,
    });
    expect(body.applicationCounts).toEqual({ "cohort-1": 17, "cohort-2": 4 });
  });

  it("returns mayImmersionRsvped=true when the Luma doc exists", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: "user-123",
        email: "applicant@example.com",
        name: "Test Applicant",
        phone: "555-1234",
        cohorts: ["cohort-1"],
        siteId: "cursor-boston",
        status: "pending",
      }),
    });
    mockLumaDocGet.mockResolvedValue({ exists: true });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application.mayImmersionRsvped).toBe(true);
  });

  it("returns null isLocal/wantsToPresent for legacy applications missing those fields", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: "user-123",
        email: "applicant@example.com",
        name: "Test Applicant",
        phone: "555-1234",
        cohorts: ["cohort-1"],
        siteId: "cursor-boston",
        status: "pending",
      }),
    });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application.isLocal).toBeNull();
    expect(body.application.wantsToPresent).toBeNull();
  });
});
