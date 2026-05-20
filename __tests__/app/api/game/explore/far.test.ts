/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage — `app/api/game/explore/far/route.ts` (25%, 9
 * uncovered branches). Covers: 401 unauthenticated, content-length
 * present + valid JSON, content-length present + non-JSON (try/catch),
 * content-length present + whitespace-only body (no parse), content-length
 * absent (skips body branch entirely), happy path returns full result
 * shape, and mapGameError fallback on thrown error.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

// Preserve the real error-class exports (mapGameError uses `instanceof`
// on them) while replacing only the server action with a jest.fn().
jest.mock("@/lib/game/data-server", () => ({
  ...jest.requireActual("@/lib/game/data-server"),
  farExpeditionExploreServer: jest.fn(),
}));

import { POST } from "@/app/api/game/explore/far/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { farExpeditionExploreServer } from "@/lib/game/data-server";

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockFarExpedition = farExpeditionExploreServer as jest.MockedFunction<
  typeof farExpeditionExploreServer
>;

function makeRequest({
  body,
  headers,
  rawBody,
}: {
  body?: unknown;
  headers?: Record<string, string>;
  rawBody?: string;
} = {}): NextRequest {
  const serialized =
    rawBody !== undefined
      ? rawBody
      : body !== undefined
        ? JSON.stringify(body)
        : undefined;
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json",
    Authorization: "Bearer test-token",
  };
  // The route gates body parsing on the presence of a content-length
  // header; NextRequest in Node doesn't auto-populate it, so set it
  // explicitly whenever we want the body branch to execute.
  if (serialized !== undefined) {
    baseHeaders["content-length"] = String(
      Buffer.byteLength(serialized, "utf8"),
    );
  }
  const init: RequestInit = {
    method: "POST",
    headers: { ...baseHeaders, ...(headers ?? {}) },
  };
  if (serialized !== undefined) {
    init.body = serialized;
  }
  return new NextRequest("http://localhost/api/game/explore/far", init);
}

const HAPPY_RESULT = {
  player: { userId: "u1" },
  tile: { id: "t-new" },
  report: { kind: "explore" },
  targetEnemyTileId: "t-enemy",
  enemyTile: { id: "t-enemy", type: "magic" },
} as unknown as Awaited<ReturnType<typeof farExpeditionExploreServer>>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/game/explore/far", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(mockFarExpedition).not.toHaveBeenCalled();
  });

  it("returns 200 with full result shape on happy path", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockResolvedValue(HAPPY_RESULT);
    const res = await POST(makeRequest({ body: {} }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // apiSuccess() flattens the result into the response body.
    expect(body.success).toBe(true);
    expect(body.targetEnemyTileId).toBe("t-enemy");
    expect(body.enemyTile).toEqual({ id: "t-enemy", type: "magic" });
    expect(body.player).toEqual({ userId: "u1" });
    expect(mockFarExpedition).toHaveBeenCalledWith("u1");
  });

  it("tolerates a request with no content-length header (skip body branch)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockResolvedValue(HAPPY_RESULT);
    // NextRequest without a body — content-length should be absent so
    // the body-parsing branch is skipped entirely.
    const req = new NextRequest("http://localhost/api/game/explore/far", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFarExpedition).toHaveBeenCalled();
  });

  it("tolerates a whitespace-only body (parsed-text trim length 0)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockResolvedValue(HAPPY_RESULT);
    const res = await POST(makeRequest({ rawBody: "   " }));
    expect(res.status).toBe(200);
    expect(mockFarExpedition).toHaveBeenCalled();
  });

  it("swallows non-JSON body via try/catch (ignores parse failure)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockResolvedValue(HAPPY_RESULT);
    const res = await POST(makeRequest({ rawBody: "not-json{{" }));
    expect(res.status).toBe(200);
    expect(mockFarExpedition).toHaveBeenCalled();
  });

  it("accepts an empty-object JSON body (schema is z.object({}).optional())", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockResolvedValue(HAPPY_RESULT);
    const res = await POST(makeRequest({ rawBody: "{}" }));
    expect(res.status).toBe(200);
    expect(mockFarExpedition).toHaveBeenCalled();
  });

  it("returns 400 when JSON body fails schema validation (non-object)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockResolvedValue(HAPPY_RESULT);
    // A JSON number parses fine but fails z.object({}).optional()
    // → exercises the parsed.success === false branch.
    const res = await POST(makeRequest({ rawBody: "42" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(mockFarExpedition).not.toHaveBeenCalled();
  });

  it("delegates thrown errors to mapGameError (500 fallback)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockFarExpedition.mockRejectedValue(new Error("kaboom"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest({ body: {} }));
    // mapGameError returns 500 for unknown Error instances.
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
