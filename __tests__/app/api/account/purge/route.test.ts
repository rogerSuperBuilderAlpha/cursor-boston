/**
 * @jest-environment node
 */

import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/account/purge/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { resumeStaleDeletions } from "@/lib/account-deletion/cascade";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/account-deletion/cascade", () => ({
  resumeStaleDeletions: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockResume = resumeStaleDeletions as jest.MockedFunction<typeof resumeStaleDeletions>;

const TEST_SECRET = "test-purge-secret-12345";

function signed(body: string, secret: string = TEST_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function purgeRequest(body: string, signature: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== null) headers["x-purge-signature"] = signature;
  return new NextRequest("http://localhost/api/account/purge", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/account/purge", () => {
  const originalSecret = process.env.ACCOUNT_PURGE_HMAC_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCOUNT_PURGE_HMAC_SECRET = TEST_SECRET;
    mockGetAdminDb.mockReturnValue({} as any);
    mockResume.mockResolvedValue([]);
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.ACCOUNT_PURGE_HMAC_SECRET;
    } else {
      process.env.ACCOUNT_PURGE_HMAC_SECRET = originalSecret;
    }
  });

  it("returns 403 when the signature header is missing", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    const res = await POST(purgeRequest(body, null));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 403 when ACCOUNT_PURGE_HMAC_SECRET is unset", async () => {
    delete process.env.ACCOUNT_PURGE_HMAC_SECRET;
    const body = JSON.stringify({ trigger: "cron" });
    const res = await POST(purgeRequest(body, signed(body)));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the signature does not match (different length)", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    const res = await POST(purgeRequest(body, "deadbeef"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the signature is the right length but wrong value", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    const wrong = signed(body, "different-secret");
    const res = await POST(purgeRequest(body, wrong));
    expect(res.status).toBe(403);
    expect(mockResume).not.toHaveBeenCalled();
  });

  it("returns 500 when admin DB is not configured", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await POST(purgeRequest(body, signed(body)));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server not configured" });
  });

  it("returns 200 with the resumed UIDs on success", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    mockResume.mockResolvedValue(["uid-a", "uid-b", "uid-c"]);
    const res = await POST(purgeRequest(body, signed(body)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      completedCount: 3,
      completedUids: ["uid-a", "uid-b", "uid-c"],
    });
    expect(mockResume).toHaveBeenCalledWith(expect.any(Object), 30 * 24 * 60 * 60 * 1000);
  });

  it("returns 200 with an empty list when no stale deletions need resuming", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    const res = await POST(purgeRequest(body, signed(body)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.completedCount).toBe(0);
    expect(json.completedUids).toEqual([]);
  });

  it("returns 500 when resumeStaleDeletions throws", async () => {
    const body = JSON.stringify({ trigger: "cron" });
    mockResume.mockRejectedValue(new Error("firestore-down"));
    const res = await POST(purgeRequest(body, signed(body)));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
