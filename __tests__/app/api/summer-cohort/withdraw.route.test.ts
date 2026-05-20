/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #155 — `app/api/summer-cohort/withdraw/route.ts`
 * (41% / 17 uncovered branches). Covers rate-limit, query-shape rejection,
 * invalid cohortId, malformed token, token-verification failure, db-unavailable,
 * empty Firestore lookup, happy-path update, and thrown errors during update.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/unsubscribe-token", () => ({
  verifyWithdrawToken: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/summer-cohort", () => ({
  isValidCohortId: jest.fn(),
  SUMMER_COHORT_COLLECTION: "summerCohortApplications",
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

import { GET } from "@/app/api/summer-cohort/withdraw/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyWithdrawToken } from "@/lib/unsubscribe-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidCohortId } from "@/lib/summer-cohort";

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockVerify = verifyWithdrawToken as jest.MockedFunction<typeof verifyWithdrawToken>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockValidCohort = isValidCohortId as jest.MockedFunction<typeof isValidCohortId>;

function makeReq(query: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/summer-cohort/withdraw");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url, { method: "GET" });
}

const validToken = "a".repeat(64);

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockReturnValue({ success: true } as never);
  mockValidCohort.mockReturnValue(true as never);
  mockVerify.mockReturnValue(true as never);
});

describe("GET /api/summer-cohort/withdraw", () => {
  it("redirects to ?status=rate-limited when rate-limited", async () => {
    mockRate.mockReturnValueOnce({ success: false } as never);
    const res = await GET(makeReq({ email: "x@y.com", cohortId: "c1", token: validToken }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("status=rate-limited");
  });

  it("redirects to ?status=invalid when query is missing fields", async () => {
    const res = await GET(makeReq({}));
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("redirects to ?status=invalid when email is missing", async () => {
    const res = await GET(makeReq({ cohortId: "c1", token: validToken }));
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("redirects to ?status=invalid when cohortId is not recognized", async () => {
    mockValidCohort.mockReturnValueOnce(false as never);
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "bogus", token: validToken })
    );
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("redirects to ?status=invalid when token is wrong length", async () => {
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "c1", token: "deadbeef" })
    );
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("redirects to ?status=invalid when token has non-hex chars", async () => {
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "c1", token: "z".repeat(64) })
    );
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("redirects to ?status=invalid when token signature fails", async () => {
    mockVerify.mockReturnValueOnce(false as never);
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "c1", token: validToken })
    );
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("redirects to ?status=error when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "c1", token: validToken })
    );
    expect(res.headers.get("location")).toContain("status=error");
  });

  it("redirects to ?status=success when no application matches (no leak)", async () => {
    mockDb.mockReturnValue({
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
        }),
      }),
    } as never);
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "c1", token: validToken })
    );
    expect(res.headers.get("location")).toContain("status=success");
  });

  it("updates the matched doc and redirects to ?status=success on happy path", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    mockDb.mockReturnValue({
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({
              empty: false,
              docs: [{ ref: { update } }],
            }),
          }),
        }),
      }),
    } as never);
    const res = await GET(
      makeReq({ email: "X@Y.com", cohortId: "c1", token: validToken })
    );
    expect(res.headers.get("location")).toContain("status=success");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "withdrawn",
        statusUpdatedAt: "TS",
        updatedAt: "TS",
      })
    );
  });

  it("redirects to ?status=error when Firestore throws", async () => {
    mockDb.mockReturnValue({
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: async () => {
              throw new Error("firestore down");
            },
          }),
        }),
      }),
    } as never);
    const res = await GET(
      makeReq({ email: "x@y.com", cohortId: "c1", token: validToken })
    );
    expect(res.headers.get("location")).toContain("status=error");
  });
});
