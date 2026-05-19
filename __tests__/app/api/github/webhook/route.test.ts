/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #75 — GitHub webhook guard rails.
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/github/webhook/route";
import {
  verifyWebhookSignature,
  processPullRequest,
  isTargetRepository,
  fetchPullRequestChangedFilenames,
} from "@/lib/github";
import { ensureHackASprint2026ScoreDoc } from "@/lib/hackathon-asprint-2026-scores";
import { awardHackASprint2026ShowcaseBadge } from "@/lib/hackathon-showcase-admin";
import { maybeAutoAdmitOnPRMerge } from "@/lib/summer-cohort-auto-admit";
import {
  notifyPROpened,
  notifyPRMerged,
  notifyHackASprintSubmissionMerged,
} from "@/lib/discord";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

// Quiet the next/cache revalidate calls in jest while preserving the rest
jest.mock("next/cache", () => ({
  ...jest.requireActual("next/cache"),
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

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
const mockProcessPullRequest = processPullRequest as jest.MockedFunction<
  typeof processPullRequest
>;
const mockIsTargetRepository = isTargetRepository as jest.MockedFunction<
  typeof isTargetRepository
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("returns 400 when pull_request payload is missing required fields", async () => {
    mockVerify.mockReturnValue(true);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: { action: "opened" },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid payload structure/i);
  });

  it("processes pull_request opened and returns received", async () => {
    mockVerify.mockReturnValue(true);
    mockProcessPullRequest.mockResolvedValue(undefined);
    mockIsTargetRepository.mockReturnValue(false);

    const payload = {
      action: "opened",
      pull_request: {
        number: 42,
        title: "Add feature",
        state: "open",
        merged: false,
        user: { login: "octocat", avatar_url: "https://example.com/a.png" },
        html_url: "https://github.com/org/repo/pull/42",
        created_at: "2026-05-19T00:00:00Z",
        updated_at: "2026-05-19T00:00:00Z",
      },
      repository: { owner: { login: "org" }, name: "repo" },
    };

    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: payload,
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });

    const { status, body } = await readJson(await POST(req));

    expect(status).toBe(200);
    expect(body).toMatchObject({ received: true, action: "opened" });
    expect(mockProcessPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ number: 42, merged: false }),
    );
  });

  it("calls notifyPROpened on pull_request opened action", async () => {
    mockVerify.mockReturnValue(true);
    mockProcessPullRequest.mockResolvedValue(undefined);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "opened",
        pull_request: {
          number: 1,
          title: "PR",
          state: "open",
          merged: false,
          user: { login: "u", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    await POST(req);
    expect(notifyPROpened).toHaveBeenCalled();
  });

  it("calls notifyPRMerged when closed + merged=true", async () => {
    mockVerify.mockReturnValue(true);
    mockIsTargetRepository.mockReturnValue(false);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "closed",
        pull_request: {
          number: 2,
          title: "Done",
          state: "closed",
          merged: true,
          merged_at: "2026-05-01",
          user: { login: "u", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-04-30",
          updated_at: "2026-05-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    await POST(req);
    expect(notifyPRMerged).toHaveBeenCalled();
  });

  it("skips showcase award when filenames don't touch the showcase path", async () => {
    mockVerify.mockReturnValue(true);
    mockIsTargetRepository.mockReturnValue(true);
    (fetchPullRequestChangedFilenames as jest.Mock).mockResolvedValue([
      "src/some-file.ts",
    ]);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "closed",
        pull_request: {
          number: 3,
          title: "Merged",
          state: "closed",
          merged: true,
          merged_at: "2026-05-01",
          user: { login: "u", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-04-30",
          updated_at: "2026-05-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    await POST(req);
    expect(awardHackASprint2026ShowcaseBadge).not.toHaveBeenCalled();
  });

  it("awards showcase badge + ensures score doc when filenames touch hackathon submissions path", async () => {
    mockVerify.mockReturnValue(true);
    mockIsTargetRepository.mockReturnValue(true);
    (fetchPullRequestChangedFilenames as jest.Mock).mockResolvedValue([
      "content/hackathons/hack-a-sprint-2026/submissions/team-alpha.json",
      "content/hackathons/hack-a-sprint-2026/submissions/team-beta.json",
    ]);
    (getAdminDb as jest.Mock).mockReturnValue({ collection: jest.fn() });
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "closed",
        pull_request: {
          number: 4,
          title: "Showcase",
          state: "closed",
          merged: true,
          merged_at: "2026-05-01",
          user: { login: "team-alpha", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-04-30",
          updated_at: "2026-05-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    await POST(req);
    expect(awardHackASprint2026ShowcaseBadge).toHaveBeenCalledWith("team-alpha");
    expect(ensureHackASprint2026ScoreDoc).toHaveBeenCalledTimes(2);
  });

  it("falls back gracefully when getAdminDb returns null (still notifies + collects logins)", async () => {
    mockVerify.mockReturnValue(true);
    mockIsTargetRepository.mockReturnValue(true);
    (fetchPullRequestChangedFilenames as jest.Mock).mockResolvedValue([
      "content/hackathons/hack-a-sprint-2026/submissions/team-alpha.json",
    ]);
    (getAdminDb as jest.Mock).mockReturnValue(null);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "closed",
        pull_request: {
          number: 5,
          title: "Showcase",
          state: "closed",
          merged: true,
          merged_at: "2026-05-01",
          user: { login: "team-alpha", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-04-30",
          updated_at: "2026-05-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    await POST(req);
    expect(notifyHackASprintSubmissionMerged).toHaveBeenCalledWith(
      expect.objectContaining({ submissionLogins: ["team-alpha"] }),
    );
    expect(ensureHackASprint2026ScoreDoc).not.toHaveBeenCalled();
  });

  it("calls maybeAutoAdmitOnPRMerge on every PR merge to target repo", async () => {
    mockVerify.mockReturnValue(true);
    mockIsTargetRepository.mockReturnValue(true);
    (fetchPullRequestChangedFilenames as jest.Mock).mockResolvedValue([]);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "closed",
        pull_request: {
          number: 6,
          title: "Merged",
          state: "closed",
          merged: true,
          merged_at: "2026-05-01",
          user: { login: "octocat", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-04-30",
          updated_at: "2026-05-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    await POST(req);
    expect(maybeAutoAdmitOnPRMerge).toHaveBeenCalledWith({
      authorLogin: "octocat",
      prNumber: 6,
    });
  });

  it("swallows processPullRequest errors and still returns 200", async () => {
    mockVerify.mockReturnValue(true);
    mockProcessPullRequest.mockRejectedValueOnce(new Error("firestore down"));
    mockIsTargetRepository.mockReturnValue(false);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "opened",
        pull_request: {
          number: 7,
          title: "PR",
          state: "open",
          merged: false,
          user: { login: "u", avatar_url: "x" },
          html_url: "u",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 received for unhandled pull_request actions (e.g. labeled)", async () => {
    mockVerify.mockReturnValue(true);
    const req = makeRequest({
      method: "POST",
      path: "/api/github/webhook",
      body: {
        action: "labeled",
        pull_request: {
          number: 8,
          title: "PR",
          state: "open",
          merged: false,
          user: { login: "u" },
          html_url: "u",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
        repository: { owner: { login: "o" }, name: "r" },
      },
      headers: {
        "x-hub-signature-256": "sha256=abc",
        "x-github-event": "pull_request",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockProcessPullRequest).not.toHaveBeenCalled();
  });
});
