/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #75 — GitHub webhook guard rails.
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/github/webhook/route";
import { verifyWebhookSignature } from "@/lib/github";

jest.mock("@/lib/github", () => ({
  verifyWebhookSignature: jest.fn(),
  processPullRequest: jest.fn(),
  isTargetRepository: jest.fn(() => false),
  fetchPullRequestChangedFilenames: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => null),
}));

jest.mock("@/lib/discord", () => ({
  notifyPROpened: jest.fn(),
  notifyPRMerged: jest.fn(),
  notifyHackASprintSubmissionMerged: jest.fn(),
}));

jest.mock("@/lib/hackathon-asprint-2026-scores", () => ({
  ensureHackASprint2026ScoreDoc: jest.fn(),
}));

jest.mock("@/lib/hackathon-showcase-admin", () => ({
  awardHackASprint2026ShowcaseBadge: jest.fn(),
}));

jest.mock("@/lib/summer-cohort-auto-admit", () => ({
  maybeAutoAdmitOnPRMerge: jest.fn(),
}));

jest.mock("@/lib/middleware", () => ({
  withLoggingMiddleware: (handler: (...a: unknown[]) => unknown) => handler,
  withRateLimitMiddleware: (_: unknown, handler: (...a: unknown[]) => unknown) =>
    handler,
  rateLimitConfigs: { webhook: { windowMs: 60_000, maxRequests: 100 } },
}));

jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}));

const mockVerify = verifyWebhookSignature as jest.MockedFunction<
  typeof verifyWebhookSignature
>;

describe("GET /api/github/webhook", () => {
  it("returns ok status", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
  });
});

describe("POST /api/github/webhook", () => {
  it("returns 401 when signature is invalid", async () => {
    mockVerify.mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      body: "{}",
      headers: { "x-hub-signature-256": "bad" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockVerify.mockReturnValue(true);
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      body: "not-json",
      headers: { "x-hub-signature-256": "sha256=abc" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns received for non-pull_request events", async () => {
    mockVerify.mockReturnValue(true);
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      body: JSON.stringify({ zen: "test" }),
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "ping",
      },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.event).toBe("ping");
  });

  it("returns 413 when content-length exceeds limit", async () => {
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      body: "{}",
      headers: { "content-length": "2000000" },
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
