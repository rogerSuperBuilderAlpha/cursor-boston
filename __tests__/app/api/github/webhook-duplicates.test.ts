/**
 * @jest-environment node
 *
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */
import { POST } from "@/app/api/github/webhook/route";
import {
  verifyWebhookSignature,
  processPullRequest,
  isTargetRepository,
} from "@/lib/github";
import { notifyPROpened } from "@/lib/discord";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("next/cache", () => ({
  ...jest.requireActual("next/cache"),
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "__serverTimestamp") },
}));

jest.mock("@/lib/github", () => ({
  verifyWebhookSignature: jest.fn(),
  processPullRequest: jest.fn(),
  isTargetRepository: jest.fn(() => false),
  fetchPullRequestChangedFilenames: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
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
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockNotifyPROpened = notifyPROpened as jest.MockedFunction<
  typeof notifyPROpened
>;

const mockDeliveryCreate = jest.fn();
const mockDeliveryDoc = jest.fn(() => ({ create: mockDeliveryCreate }));
const mockDeliveryCollection = jest.fn(() => ({ doc: mockDeliveryDoc }));

function pullRequestPayload() {
  return {
    action: "opened",
    pull_request: {
      number: 572,
      title: "Add webhook idempotency",
      state: "open",
      merged: false,
      user: { login: "octocat", avatar_url: "https://example.com/a.png" },
      html_url: "https://github.com/org/repo/pull/572",
      created_at: "2026-05-22T00:00:00Z",
      updated_at: "2026-05-22T00:00:00Z",
    },
    repository: { owner: { login: "org" }, name: "repo" },
  };
}

function webhookRequest({
  deliveryId = "delivery-572",
  eventType = "pull_request",
  body = pullRequestPayload(),
}: {
  deliveryId?: string | null;
  eventType?: string;
  body?: unknown;
} = {}) {
  const headers: Record<string, string> = {
    "x-hub-signature-256": "sha256=abc",
    "x-github-event": eventType,
  };
  if (deliveryId) {
    headers["x-github-delivery"] = deliveryId;
  }
  return makeRequest({
    method: "POST",
    path: "/api/github/webhook",
    body,
    headers,
  });
}

describe("POST /api/github/webhook duplicate delivery handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockReturnValue(true);
    mockProcessPullRequest.mockResolvedValue(undefined);
    mockIsTargetRepository.mockReturnValue(false);
    mockDeliveryCreate.mockResolvedValue(undefined);
    mockGetAdminDb.mockReturnValue({
      collection: mockDeliveryCollection,
    } as never);
  });

  it("stores the GitHub delivery id before processing a valid pull_request event", async () => {
    const { status, body } = await readJson(await POST(webhookRequest()));

    expect(status).toBe(200);
    expect(body).toMatchObject({ received: true, action: "opened" });
    expect(mockDeliveryCollection).toHaveBeenCalledWith(
      "githubWebhookDeliveries"
    );
    expect(mockDeliveryDoc).toHaveBeenCalledWith("delivery-572");
    expect(mockDeliveryCreate).toHaveBeenCalledWith({
      deliveryId: "delivery-572",
      eventType: "pull_request",
      receivedAt: "__serverTimestamp",
    });
    expect(mockNotifyPROpened).toHaveBeenCalledTimes(1);
    expect(mockProcessPullRequest).toHaveBeenCalledTimes(1);
  });

  it("processes the same delivery id only once when GitHub replays it", async () => {
    mockDeliveryCreate
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error("exists"), { code: 6 }));

    const first = await readJson(await POST(webhookRequest()));
    const second = await readJson(await POST(webhookRequest()));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      received: true,
      action: "opened",
      duplicate: true,
    });
    expect(mockDeliveryCreate).toHaveBeenCalledTimes(2);
    expect(mockNotifyPROpened).toHaveBeenCalledTimes(1);
    expect(mockProcessPullRequest).toHaveBeenCalledTimes(1);
  });

  it("treats Firestore already-exists string codes as duplicate deliveries", async () => {
    mockDeliveryCreate.mockRejectedValueOnce(
      Object.assign(new Error("exists"), { code: "already-exists" })
    );

    const { status, body } = await readJson(await POST(webhookRequest()));

    expect(status).toBe(200);
    expect(body).toMatchObject({
      received: true,
      action: "opened",
      duplicate: true,
    });
    expect(mockNotifyPROpened).not.toHaveBeenCalled();
    expect(mockProcessPullRequest).not.toHaveBeenCalled();
  });

  it("preserves legacy processing when GitHub omits the delivery header", async () => {
    const { status, body } = await readJson(
      await POST(webhookRequest({ deliveryId: null }))
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ received: true, action: "opened" });
    expect(mockDeliveryCollection).not.toHaveBeenCalled();
    expect(mockNotifyPROpened).toHaveBeenCalledTimes(1);
    expect(mockProcessPullRequest).toHaveBeenCalledTimes(1);
  });

  it("does not reserve a delivery id for invalid pull_request payloads", async () => {
    const { status, body } = await readJson(
      await POST(webhookRequest({ body: { action: "opened" } }))
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid payload structure" });
    expect(mockDeliveryCollection).not.toHaveBeenCalled();
    expect(mockNotifyPROpened).not.toHaveBeenCalled();
    expect(mockProcessPullRequest).not.toHaveBeenCalled();
  });

  it("fails before side effects when the delivery reservation cannot be written", async () => {
    mockDeliveryCreate.mockRejectedValueOnce(new Error("firestore down"));

    const { status, body } = await readJson(await POST(webhookRequest()));

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Internal server error" });
    expect(mockNotifyPROpened).not.toHaveBeenCalled();
    expect(mockProcessPullRequest).not.toHaveBeenCalled();
  });
});
