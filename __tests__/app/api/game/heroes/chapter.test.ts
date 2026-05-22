/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #151 —
 *   app/api/game/heroes/[heroId]/chapter/[chapterId]/route.ts
 *
 * Covers the DELETE (soft-delete) and PATCH (admin approve) handlers
 * for an individual hero-lore chapter.
 */

import { NextRequest } from "next/server";
import {
  DELETE,
  PATCH,
} from "@/app/api/game/heroes/[heroId]/chapter/[chapterId]/route";
import { getVerifiedUser, isCurrentIdTokenRevoked } from "@/lib/server-auth";
import {
  HeroLoreForbiddenError,
  HeroLoreNotFoundError,
} from "@/lib/game/hero-lore";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
  isCurrentIdTokenRevoked: jest.fn(async () => false),
}));

jest.mock("@/lib/game/hero-lore", () => {
  const actual = jest.requireActual("@/lib/game/hero-lore");
  return {
    ...actual,
    deleteHeroChapterServer: jest.fn(),
    approveHeroChapterServer: jest.fn(),
  };
});

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockIsRevoked = isCurrentIdTokenRevoked as jest.MockedFunction<
  typeof isCurrentIdTokenRevoked
>;

function makeReq(method: "DELETE" | "PATCH") {
  return new NextRequest(
    "https://example.com/api/game/heroes/h1/chapter/c1",
    { method },
  );
}

function withParams(heroId: string, chapterId: string) {
  return { params: Promise.resolve({ heroId, chapterId }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({
    uid: "u1",
    email: "u@x",
    isAdmin: false,
  } as never);
  mockIsRevoked.mockResolvedValue(false);
  const { deleteHeroChapterServer, approveHeroChapterServer } = jest.requireMock(
    "@/lib/game/hero-lore",
  ) as {
    deleteHeroChapterServer: jest.Mock;
    approveHeroChapterServer: jest.Mock;
  };
  deleteHeroChapterServer.mockResolvedValue({ id: "c1", deletedAt: 123 });
  approveHeroChapterServer.mockResolvedValue({
    id: "c1",
    status: "approved",
  });
});

describe("DELETE /api/game/heroes/[heroId]/chapter/[chapterId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when heroId is missing", async () => {
    const res = await DELETE(makeReq("DELETE"), withParams("", "c1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when chapterId is missing", async () => {
    const res = await DELETE(makeReq("DELETE"), withParams("h1", ""));
    expect(res.status).toBe(400);
  });

  it("returns 200 and forwards callerIsAdmin=false for non-admins", async () => {
    const res = await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    expect(res.status).toBe(200);
    const { deleteHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { deleteHeroChapterServer: jest.Mock };
    expect(deleteHeroChapterServer).toHaveBeenCalledWith({
      heroId: "h1",
      chapterId: "c1",
      callerUserId: "u1",
      callerIsAdmin: false,
    });
  });

  it("forwards callerIsAdmin=true for admins", async () => {
    mockUser.mockResolvedValueOnce({
      uid: "admin",
      isAdmin: true,
    } as never);
    await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    const { deleteHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { deleteHeroChapterServer: jest.Mock };
    expect(deleteHeroChapterServer).toHaveBeenCalledWith(
      expect.objectContaining({ callerIsAdmin: true }),
    );
  });

  it("returns 404 on HeroLoreNotFoundError", async () => {
    const { deleteHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { deleteHeroChapterServer: jest.Mock };
    deleteHeroChapterServer.mockRejectedValueOnce(
      new HeroLoreNotFoundError("chapter gone"),
    );
    const res = await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    expect(res.status).toBe(404);
  });

  it("returns 403 on HeroLoreForbiddenError", async () => {
    const { deleteHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { deleteHeroChapterServer: jest.Mock };
    deleteHeroChapterServer.mockRejectedValueOnce(
      new HeroLoreForbiddenError("not yours"),
    );
    const res = await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    expect(res.status).toBe(403);
  });

  it("returns 500 with message on unknown Error", async () => {
    const { deleteHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { deleteHeroChapterServer: jest.Mock };
    deleteHeroChapterServer.mockRejectedValueOnce(new Error("boom"));
    const res = await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("boom");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    const { deleteHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { deleteHeroChapterServer: jest.Mock };
    deleteHeroChapterServer.mockRejectedValueOnce("plain-string");
    const res = await DELETE(makeReq("DELETE"), withParams("h1", "c1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});

describe("PATCH /api/game/heroes/[heroId]/chapter/[chapterId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq("PATCH"), withParams("h1", "c1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    const res = await PATCH(makeReq("PATCH"), withParams("h1", "c1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when heroId is missing", async () => {
    mockUser.mockResolvedValueOnce({ uid: "admin", isAdmin: true } as never);
    const res = await PATCH(makeReq("PATCH"), withParams("", "c1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when chapterId is missing", async () => {
    mockUser.mockResolvedValueOnce({ uid: "admin", isAdmin: true } as never);
    const res = await PATCH(makeReq("PATCH"), withParams("h1", ""));
    expect(res.status).toBe(400);
  });

  it("returns 200 on happy path and forwards approverUserId", async () => {
    mockUser.mockResolvedValueOnce({ uid: "admin", isAdmin: true } as never);
    const res = await PATCH(makeReq("PATCH"), withParams("h1", "c1"));
    expect(res.status).toBe(200);
    const { approveHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { approveHeroChapterServer: jest.Mock };
    expect(approveHeroChapterServer).toHaveBeenCalledWith({
      heroId: "h1",
      chapterId: "c1",
      approverUserId: "admin",
    });
  });

  it("returns 404 on HeroLoreNotFoundError", async () => {
    mockUser.mockResolvedValueOnce({ uid: "admin", isAdmin: true } as never);
    const { approveHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { approveHeroChapterServer: jest.Mock };
    approveHeroChapterServer.mockRejectedValueOnce(
      new HeroLoreNotFoundError("nope"),
    );
    const res = await PATCH(makeReq("PATCH"), withParams("h1", "c1"));
    expect(res.status).toBe(404);
  });

  it("returns 500 with message on unknown Error", async () => {
    mockUser.mockResolvedValueOnce({ uid: "admin", isAdmin: true } as never);
    const { approveHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { approveHeroChapterServer: jest.Mock };
    approveHeroChapterServer.mockRejectedValueOnce(new Error("boom"));
    const res = await PATCH(makeReq("PATCH"), withParams("h1", "c1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("boom");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    mockUser.mockResolvedValueOnce({ uid: "admin", isAdmin: true } as never);
    const { approveHeroChapterServer } = jest.requireMock(
      "@/lib/game/hero-lore",
    ) as { approveHeroChapterServer: jest.Mock };
    approveHeroChapterServer.mockRejectedValueOnce("string-throw");
    const res = await PATCH(makeReq("PATCH"), withParams("h1", "c1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});
