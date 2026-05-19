/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: any) => handler,
  rateLimitConfigs: { oauthCallback: {} },
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockGetCursorApiKeyForUser = jest.fn();
const mockLaunchPrIdeaRun = jest.fn();
const mockGetCursorRunSnapshot = jest.fn();
const mockCancelCursorRun = jest.fn();
const mockArchiveCursorAgent = jest.fn();
const mockDeleteCursorAgent = jest.fn();
const mockSendCursorFollowUp = jest.fn();
const mockLaunchCursorAgentRun = jest.fn();

class MissingCursorConnectionError extends Error {}

jest.mock("@/lib/cursor/cloud-agents", () => ({
  getCursorApiKeyForUser: (...args: unknown[]) => mockGetCursorApiKeyForUser(...args),
  launchPrIdeaRun: (...args: unknown[]) => mockLaunchPrIdeaRun(...args),
  getCursorRunSnapshot: (...args: unknown[]) => mockGetCursorRunSnapshot(...args),
  cancelCursorRun: (...args: unknown[]) => mockCancelCursorRun(...args),
  archiveCursorAgent: (...args: unknown[]) => mockArchiveCursorAgent(...args),
  deleteCursorAgent: (...args: unknown[]) => mockDeleteCursorAgent(...args),
  sendCursorFollowUp: (...args: unknown[]) => mockSendCursorFollowUp(...args),
  launchCursorAgentRun: (...args: unknown[]) => mockLaunchCursorAgentRun(...args),
  MissingCursorConnectionError,
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "SERVER_TIME") },
  Timestamp: class Timestamp {},
}));

type StoredDoc = Record<string, unknown>;

const docs = new Map<string, StoredDoc>();
let nextDocId = "run-1";

function docRef(id: string) {
  return {
    id,
    get: jest.fn(async () => ({
      id,
      exists: docs.has(id),
      data: () => docs.get(id),
    })),
    set: jest.fn(async (data: StoredDoc, options?: { merge?: boolean }) => {
      docs.set(id, options?.merge ? { ...(docs.get(id) ?? {}), ...data } : data);
    }),
    delete: jest.fn(async () => {
      docs.delete(id);
    }),
  };
}

const collectionRef = {
  doc: jest.fn((id?: string) => docRef(id ?? nextDocId)),
  where: jest.fn(() => collectionRef),
  orderBy: jest.fn(() => collectionRef),
  limit: jest.fn(() => collectionRef),
  get: jest.fn(async () => ({
    docs: Array.from(docs.entries()).map(([id, data]) => ({ id, data: () => data })),
  })),
};

const mockDb = {
  collection: jest.fn(() => collectionRef),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

const mockUser: VerifiedUser = { uid: "user-1", name: "Test User" };
const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function params(runId: string) {
  return { params: Promise.resolve({ runId }) };
}

describe("Cursor idea runs API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docs.clear();
    nextDocId = "run-1";
    mockGetVerifiedUser.mockResolvedValue(mockUser);
    mockGetCursorApiKeyForUser.mockResolvedValue("cursor-key");
    mockLaunchPrIdeaRun.mockResolvedValue({
      cursorAgentId: "bc-agent-1",
      cursorRunId: "run-sdk-1",
      cursorAgentUrl: "https://cursor.com/agents?id=bc-agent-1",
    });
    mockGetCursorRunSnapshot.mockResolvedValue({
      status: "finished",
      result: "Idea 1",
      activity: [{ id: "msg-1", role: "assistant", summary: "Inspecting routes" }],
      cursorStatusDetail: "Agent finished",
      durationMs: 12000,
    });
    mockSendCursorFollowUp.mockResolvedValue({ cursorRunId: "follow-up-1" });
    mockLaunchCursorAgentRun.mockResolvedValue({
      cursorAgentId: "bc-agent-fresh",
      cursorRunId: "fresh-run-1",
      cursorAgentUrl: "https://cursor.com/agents?id=bc-agent-fresh",
    });
  });

  it("launches a Cursor PR idea run and stores SDK ids", async () => {
    const { POST } = await import("@/app/api/cursor/idea-runs/route");
    const res = await POST(request("/api/cursor/idea-runs", "POST", { interests: "docs" }));

    expect(res.status).toBe(202);
    expect(mockLaunchPrIdeaRun).toHaveBeenCalledWith(
      "cursor-key",
      expect.stringContaining("Return 3-5 concrete"),
      "run-1"
    );
    expect(docs.get("run-1")).toMatchObject({
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      cursorAgentId: "bc-agent-1",
      cursorRunId: "run-sdk-1",
    });
  });

  it("returns 404 when Cursor is not connected", async () => {
    mockGetCursorApiKeyForUser.mockRejectedValueOnce(new MissingCursorConnectionError());
    const { POST } = await import("@/app/api/cursor/idea-runs/route");
    const res = await POST(request("/api/cursor/idea-runs", "POST", {}));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "cursor_not_connected" });
  });

  it("lists and refreshes non-terminal runs", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      cursorAgentId: "bc-agent-1",
      cursorRunId: "run-sdk-1",
      prompt: "Prompt",
      inputs: {},
    });
    const { GET } = await import("@/app/api/cursor/idea-runs/route");
    const res = await GET(request("/api/cursor/idea-runs"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetCursorRunSnapshot).toHaveBeenCalled();
    expect(body.runs[0]).toMatchObject({
      id: "run-1",
      status: "finished",
      result: "Idea 1",
      activity: [{ id: "msg-1", role: "assistant", summary: "Inspecting routes" }],
      cursorStatusDetail: "Agent finished",
      durationMs: 12000,
    });
  });

  it("rejects detail access for runs owned by another user", async () => {
    docs.set("run-1", {
      userId: "other-user",
      type: "pr_ideas",
      status: "finished",
      prompt: "Prompt",
      inputs: {},
    });
    const { GET } = await import("@/app/api/cursor/idea-runs/[runId]/route");
    const res = await GET(request("/api/cursor/idea-runs/run-1"), params("run-1"));

    expect(res.status).toBe(404);
  });

  it("cancels an active run", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      cursorAgentId: "bc-agent-1",
      cursorRunId: "run-sdk-1",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/cancel/route");
    const res = await POST(request("/api/cursor/idea-runs/run-1/cancel", "POST"), params("run-1"));

    expect(res.status).toBe(200);
    expect(mockCancelCursorRun).toHaveBeenCalledWith("cursor-key", "bc-agent-1", "run-sdk-1");
    expect(docs.get("run-1")).toMatchObject({ status: "cancelled" });
  });

  it("archives the backing Cursor agent", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/archive/route");
    const res = await POST(request("/api/cursor/idea-runs/run-1/archive", "POST"), params("run-1"));

    expect(res.status).toBe(200);
    expect(mockArchiveCursorAgent).toHaveBeenCalledWith("cursor-key", "bc-agent-1");
    expect(docs.get("run-1")?.archivedAt).toBeInstanceOf(Date);
  });

  it("deletes the Cursor agent and local run record", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
    });
    const { DELETE } = await import("@/app/api/cursor/idea-runs/[runId]/route");
    const res = await DELETE(request("/api/cursor/idea-runs/run-1", "DELETE"), params("run-1"));

    expect(res.status).toBe(200);
    expect(mockDeleteCursorAgent).toHaveBeenCalledWith("cursor-key", "bc-agent-1");
    expect(docs.has("run-1")).toBe(false);
  });

  it("starts the questions workflow for a selected idea", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "ideas",
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
      result: "Idea list",
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/questions/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/questions", "POST", { selectedIdea: "Improve Q&A" }),
      params("run-1")
    );

    expect(res.status).toBe(202);
    expect(mockSendCursorFollowUp).toHaveBeenCalledWith(
      "cursor-key",
      "bc-agent-1",
      expect.stringContaining("Ask exactly 3"),
      "run-1:questions"
    );
    expect(docs.get("run-1")).toMatchObject({
      selectedIdea: "Improve Q&A",
      workflowStage: "questions",
      questionRunId: "follow-up-1",
      questions: [],
    });
  });

  it("rejects questions before ideas are ready", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "ideas",
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
      result: null,
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/questions/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/questions", "POST", { selectedIdea: "Improve Q&A" }),
      params("run-1")
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "ideas_not_ready" });
  });

  it("refreshes generated questions from the agent result", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "questions",
      cursorAgentId: "bc-agent-1",
      questionRunId: "question-run-1",
      selectedIdea: "Improve Q&A",
      questions: [],
      prompt: "Prompt",
      inputs: {},
    });
    mockGetCursorRunSnapshot.mockResolvedValueOnce({
      status: "finished",
      result: JSON.stringify([
        {
          id: "audience",
          question: "Who is this for?",
          suggestions: ["New members", "Maintainers"],
        },
      ]),
    });
    const { GET } = await import("@/app/api/cursor/idea-runs/[runId]/route");
    const res = await GET(request("/api/cursor/idea-runs/run-1"), params("run-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.run.questions).toEqual([
      {
        id: "audience",
        question: "Who is this for?",
        suggestions: ["New members", "Maintainers"],
      },
    ]);
  });

  it("submits answers and creates a build plan", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "questions",
      cursorAgentId: "bc-agent-1",
      selectedIdea: "Improve Q&A",
      questions: [{ id: "goal", question: "Goal?" }],
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/answers/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/answers", "POST", {
        answers: { goal: "Make it easier to ask" },
      }),
      params("run-1")
    );

    expect(res.status).toBe(202);
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "planning",
      planRunId: "follow-up-1",
      buildPlan: null,
      questions: [{ id: "goal", question: "Goal?", answer: "Make it easier to ask" }],
    });
  });

  it("rejects answers before questions exist", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "questions",
      cursorAgentId: "bc-agent-1",
      selectedIdea: "Improve Q&A",
      questions: [],
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/answers/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/answers", "POST", { answers: {} }),
      params("run-1")
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "questions_not_ready" });
  });

  it("approves a plan and starts the build run", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "plan_approval",
      cursorAgentId: "bc-agent-1",
      buildPlan: "## Plan",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/approve-plan/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/approve-plan", "POST", {}),
      params("run-1")
    );

    expect(res.status).toBe(202);
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "building",
      buildRunId: "follow-up-1",
      planApprovedAt: "SERVER_TIME",
    });
  });

  it("opens a PR after build readiness", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "ready_for_pr",
      cursorAgentId: "bc-agent-1",
      buildResult: "Built",
      pr: { status: "not_started" },
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/open-pr/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/open-pr", "POST", {}),
      params("run-1")
    );

    expect(res.status).toBe(202);
    expect(mockSendCursorFollowUp).toHaveBeenCalledWith(
      "cursor-key",
      "bc-agent-1",
      expect.stringContaining("Open a pull request"),
      "run-1:pr",
      { autoCreatePR: true }
    );
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "pr_open",
      prRunId: "follow-up-1",
      pr: { status: "opening", openedAt: "SERVER_TIME" },
    });
  });

  it("rejects opening a PR before the build is ready", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "building",
      cursorAgentId: "bc-agent-1",
      buildResult: null,
      pr: { status: "not_started" },
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/open-pr/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/open-pr", "POST", {}),
      params("run-1")
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "invalid_stage" });
  });

  it("starts a fresh build agent from an approved plan", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "plan_approval",
      cursorAgentId: "bc-agent-1",
      buildPlan: "## Plan",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1")
    );

    expect(res.status).toBe(202);
    expect(mockLaunchCursorAgentRun).toHaveBeenCalledWith(
      "cursor-key",
      expect.stringContaining("The user approved this build plan"),
      expect.stringContaining("run-1:build:fresh"),
      { name: "Cursor Boston PR build", autoCreatePR: false }
    );
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "building",
      cursorAgentId: "bc-agent-fresh",
      buildRunId: "fresh-run-1",
      status: "running",
    });
  });

  it("recover-agent returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthenticated" });
  });

  it("recover-agent returns 500 when admin db missing", async () => {
    const fbAdmin = require("@/lib/firebase-admin");
    fbAdmin.getAdminDb.mockReturnValueOnce(null);
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("recover-agent returns 404 when run does not exist for user", async () => {
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/missing-run/recover-agent", "POST", {}),
      params("missing-run"),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("recover-agent returns 409 when ideas stage has no result or selectedIdea", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "ideas",
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "recovery_not_available" });
  });

  it("recover-agent advances from ideas → questions when selectedIdea exists", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "ideas",
      cursorAgentId: "bc-agent-1",
      selectedIdea: "Add a cache layer",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(202);
    expect(mockLaunchCursorAgentRun).toHaveBeenCalledWith(
      "cursor-key",
      expect.any(String),
      expect.stringContaining("run-1:questions:fresh"),
      { name: "Cursor Boston PR questions", autoCreatePR: false },
    );
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "questions",
      questionRunId: "fresh-run-1",
      status: "running",
    });
  });

  it("recover-agent advances from questions → plan when selectedIdea + questions present", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "questions",
      cursorAgentId: "bc-agent-1",
      selectedIdea: "Refactor X",
      questions: [{ id: "q1", text: "Scope?" }],
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(202);
    expect(mockLaunchCursorAgentRun).toHaveBeenCalledWith(
      "cursor-key",
      expect.any(String),
      expect.stringContaining("run-1:plan:fresh"),
      { name: "Cursor Boston PR plan", autoCreatePR: false },
    );
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "planning",
      planRunId: "fresh-run-1",
    });
  });

  it("recover-agent advances from ready_for_pr → pr stage with autoCreatePR=true and pr opening object", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "ready_for_pr",
      cursorAgentId: "bc-agent-1",
      buildResult: "Built it",
      pr: { previous: "value" },
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(202);
    expect(mockLaunchCursorAgentRun).toHaveBeenCalledWith(
      "cursor-key",
      expect.stringContaining("Open a pull request"),
      expect.stringContaining("run-1:pr:fresh"),
      { name: "Cursor Boston PR open", autoCreatePR: true },
    );
    expect(docs.get("run-1")).toMatchObject({
      workflowStage: "pr_open",
      prRunId: "fresh-run-1",
    });
    const stored = docs.get("run-1") as Record<string, unknown>;
    expect(stored.pr).toMatchObject({ previous: "value", status: "opening" });
  });

  it("recover-agent returns 409 when workflowStage is not recoverable (e.g. running ideas with no buildPlan)", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "running",
      workflowStage: "plan_approval",
      // No buildPlan → no recovery prompt
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
    });
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(409);
  });

  it("recover-agent returns 500 when launchCursorAgentRun throws", async () => {
    docs.set("run-1", {
      userId: "user-1",
      type: "pr_ideas",
      status: "finished",
      workflowStage: "plan_approval",
      buildPlan: "## Plan",
      cursorAgentId: "bc-agent-1",
      prompt: "Prompt",
      inputs: {},
    });
    mockLaunchCursorAgentRun.mockRejectedValueOnce(new Error("cursor api 503"));
    const { POST } = await import("@/app/api/cursor/idea-runs/[runId]/recover-agent/route");
    const res = await POST(
      request("/api/cursor/idea-runs/run-1/recover-agent", "POST", {}),
      params("run-1"),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "recovery_failed" });
  });
});
