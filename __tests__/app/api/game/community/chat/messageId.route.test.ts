/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #155 — DELETE `/api/game/community/chat/[messageId]`
 * (40% / 6 uncovered branches). Covers 401 unauth, 400 missing id, 404 not-found,
 * 403 forbidden, 500 generic-error, and 200 happy-path including admin override.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/community", () => {
  class CommunityMessageNotFoundError extends Error {
    constructor(msg = "not found") {
      super(msg);
      this.name = "CommunityMessageNotFoundError";
    }
  }
  class CommunityMessageForbiddenError extends Error {
    constructor(msg = "forbidden") {
      super(msg);
      this.name = "CommunityMessageForbiddenError";
    }
  }
  return {
    CommunityMessageNotFoundError,
    CommunityMessageForbiddenError,
    deleteCommunityMessage: jest.fn(),
  };
});

import { DELETE } from "@/app/api/game/community/chat/[messageId]/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  deleteCommunityMessage,
  CommunityMessageNotFoundError,
  CommunityMessageForbiddenError,
} from "@/lib/game/community";

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDelete = deleteCommunityMessage as jest.MockedFunction<typeof deleteCommunityMessage>;

function makeReq() {
  return new NextRequest("http://localhost/api/game/community/chat/m1", {
    method: "DELETE",
  });
}

function ctx(messageId: string | undefined) {
  return { params: Promise.resolve({ messageId: messageId as string }) };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DELETE /api/game/community/chat/[messageId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq(), ctx("m1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when messageId is empty", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    const res = await DELETE(makeReq(), ctx(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 when message not found", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockDelete.mockRejectedValueOnce(new CommunityMessageNotFoundError("missing"));
    const res = await DELETE(makeReq(), ctx("m1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("missing");
  });

  it("returns 403 when caller is forbidden", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockDelete.mockRejectedValueOnce(new CommunityMessageForbiddenError("no"));
    const res = await DELETE(makeReq(), ctx("m1"));
    expect(res.status).toBe(403);
  });

  it("returns 500 on generic Error", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockDelete.mockRejectedValueOnce(new Error("boom"));
    const res = await DELETE(makeReq(), ctx("m1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe("boom");
  });

  it("returns 500 on non-Error throw, with fallback message", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockDelete.mockRejectedValueOnce("string-not-error");
    const res = await DELETE(makeReq(), ctx("m1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe("Server error");
  });

  it("returns 200 on success and passes callerIsAdmin=false by default", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockDelete.mockResolvedValueOnce({ id: "m1", deletedAt: 1 } as never);
    const res = await DELETE(makeReq(), ctx("m1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toEqual({ id: "m1", deletedAt: 1 });
    expect(mockDelete).toHaveBeenCalledWith({
      messageId: "m1",
      callerUserId: "u1",
      callerIsAdmin: false,
    });
  });

  it("propagates callerIsAdmin=true when the verified user is admin", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1", isAdmin: true } as never);
    mockDelete.mockResolvedValueOnce({ id: "m1" } as never);
    await DELETE(makeReq(), ctx("m1"));
    expect(mockDelete).toHaveBeenCalledWith({
      messageId: "m1",
      callerUserId: "u1",
      callerIsAdmin: true,
    });
  });
});
