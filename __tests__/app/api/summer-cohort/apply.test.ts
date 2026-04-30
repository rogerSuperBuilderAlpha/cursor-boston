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

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({
      doc: () => ({ get: mockDocGet, set: mockDocSet }),
      orderBy: () => ({ get: mockOrderByGet }),
    }),
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

describe("POST /api/summer-cohort/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      }),
    });
    mockOrderByGet.mockResolvedValue({ docs: [] });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(
      makePost({ name: "x", phone: "1", cohorts: ["cohort-1"] })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when token has no email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u", name: "x" });
    const res = await POST(
      makePost({ name: "x", phone: "1", cohorts: ["cohort-1"] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(makePost(null, { rawString: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makePost({ phone: "1", cohorts: ["cohort-1"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    const res = await POST(makePost({ name: "x", cohorts: ["cohort-1"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no valid cohorts are selected", async () => {
    const res = await POST(makePost({ name: "x", phone: "1", cohorts: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when cohorts contains only invalid ids", async () => {
    const res = await POST(
      makePost({ name: "x", phone: "1", cohorts: ["cohort-99", "fake"] })
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
        name: "Test Applicant",
        phone: "555-1234",
        cohorts: ["cohort-1", "cohort-2", "cohort-1"], // dedupe
      })
    );
    expect(res.status).toBe(200);
    expect(mockDocSet).toHaveBeenCalled();
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
        }),
      });

    const res = await POST(
      makePost({ name: "Updated Name", phone: "555-9999", cohorts: ["cohort-2"] })
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
    mockGetVerifiedUser.mockResolvedValue(baseUser);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns null application when no doc exists", async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application).toBeNull();
  });

  it("returns serialized application when doc exists", async () => {
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
      createdAt: 1717000000000,
    });
  });
});
