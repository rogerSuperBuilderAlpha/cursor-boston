/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — cursor idea-run-store Firestore helpers.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  applyRunSnapshot,
  applyWorkflowRunSnapshot,
  cursorIdeaRunFromSnapshot,
  getUserOwnedIdeaRun,
  isTerminalCursorRunStatus,
  serializeCursorIdeaRun,
} from "@/lib/cursor/idea-run-store";
import type { CursorIdeaRunRecord } from "@/lib/cursor/idea-runs";
import type { CursorRunSnapshot } from "@/lib/cursor/cloud-agents";

function baseRun(overrides: Partial<CursorIdeaRunRecord> = {}): CursorIdeaRunRecord {
  return {
    id: "run-1",
    userId: "user-1",
    type: "pr_ideas",
    status: "running",
    workflowStage: "plan_approval",
    prompt: "",
    inputs: {},
    result: null,
    selectedIdea: null,
    questions: [],
    buildPlan: "plan body",
    buildResult: null,
    pr: { status: "not_started" },
    artifacts: [],
    error: null,
    createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
    finishedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function mockDb() {
  const set = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn();
  const doc = jest.fn(() => ({ get, set }));
  const collection = jest.fn(() => ({ doc }));
  return { db: { collection } as never, set, get, doc };
}

describe("isTerminalCursorRunStatus", () => {
  it("treats finished, error, and cancelled as terminal", () => {
    expect(isTerminalCursorRunStatus("finished")).toBe(true);
    expect(isTerminalCursorRunStatus("error")).toBe(true);
    expect(isTerminalCursorRunStatus("cancelled")).toBe(true);
    expect(isTerminalCursorRunStatus("running")).toBe(false);
    expect(isTerminalCursorRunStatus("starting")).toBe(false);
  });
});

describe("cursorIdeaRunFromSnapshot", () => {
  it("maps document fields into a run record", () => {
    const run = cursorIdeaRunFromSnapshot({
      id: "abc",
      data: () => ({
        userId: "u1",
        status: "running",
        workflowStage: "ideas",
        prompt: "go",
      }),
    } as never);
    expect(run.id).toBe("abc");
    expect(run.userId).toBe("u1");
    expect(run.type).toBe("pr_ideas");
    expect(run.inputs).toEqual({});
    expect(run.questions).toEqual([]);
  });

  it("throws when snapshot has no data", () => {
    expect(() =>
      cursorIdeaRunFromSnapshot({ id: "x", data: () => undefined } as never),
    ).toThrow("Cursor idea run snapshot has no data");
  });
});

describe("serializeCursorIdeaRun PR timestamps", () => {
  it("serializes nested pr timestamps", () => {
    const run = baseRun({
      pr: {
        status: "pr_open",
        openedAt: Timestamp.fromDate(new Date("2026-03-01T00:00:00Z")),
        lastCommentedAt: null,
        mergedAt: FieldValue.serverTimestamp() as never,
      },
    });
    const serialized = serializeCursorIdeaRun(run);
    expect(serialized.pr?.openedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(typeof serialized.pr?.mergedAt).toBe("string");
  });
});

describe("getUserOwnedIdeaRun", () => {
  it("returns null when the document is missing", async () => {
    const { db, get } = mockDb();
    get.mockResolvedValue({ exists: false });
    await expect(getUserOwnedIdeaRun(db, "user-1", "run-1")).resolves.toBeNull();
  });

  it("returns null when the run belongs to another user", async () => {
    const { db, get } = mockDb();
    get.mockResolvedValue({
      exists: true,
      id: "run-1",
      data: () => ({ userId: "other", status: "running", prompt: "" }),
    });
    await expect(getUserOwnedIdeaRun(db, "user-1", "run-1")).resolves.toBeNull();
  });

  it("returns the run when owned by the caller", async () => {
    const { db, get } = mockDb();
    get.mockResolvedValue({
      exists: true,
      id: "run-1",
      data: () => ({ userId: "user-1", status: "running", prompt: "hi" }),
    });
    const run = await getUserOwnedIdeaRun(db, "user-1", "run-1");
    expect(run?.userId).toBe("user-1");
    expect(run?.id).toBe("run-1");
  });
});

describe("applyRunSnapshot", () => {
  it("writes terminal status and finishedAt when the cursor run completes", async () => {
    const { db, set } = mockDb();
    const run = baseRun({ status: "running", result: "old" });
    const snapshot: CursorRunSnapshot = {
      status: "finished",
      result: "new ideas",
      durationMs: 1200,
    };
    const next = await applyRunSnapshot(db, run, snapshot);
    expect(set).toHaveBeenCalled();
    expect(next.status).toBe("finished");
    expect(next.result).toBe("new ideas");
    expect(next.finishedAt).toBeDefined();
  });

  it("sets a default error message when snapshot status is error", async () => {
    const { db, set } = mockDb();
    const run = baseRun({ status: "running", error: null });
    const next = await applyRunSnapshot(db, run, { status: "error" });
    expect(set).toHaveBeenCalled();
    expect(next.error).toBe("Cursor run failed");
    expect(next.status).toBe("error");
  });
});

describe("applyWorkflowRunSnapshot", () => {
  it("advances building stage to ready_for_pr on success", async () => {
    const { db, set } = mockDb();
    const run = baseRun({
      workflowStage: "building",
      status: "running",
      buildResult: null,
    });
    const next = await applyWorkflowRunSnapshot(db, run, {
      status: "finished",
      result: "built output",
    });
    expect(set).toHaveBeenCalled();
    expect(next.workflowStage).toBe("ready_for_pr");
    expect(next.buildResult).toBe("built output");
  });

  it("parses questions JSON when the questions stage finishes", async () => {
    const { db, set } = mockDb();
    const run = baseRun({
      workflowStage: "questions",
      status: "running",
      questions: [],
    });
    const payload =
      'Here are questions [{"id":"q1","question":"Scope?","suggestions":["Small","Medium"]}]';
    const next = await applyWorkflowRunSnapshot(db, run, {
      status: "finished",
      result: payload,
    });
    expect(next.questions).toHaveLength(1);
    expect(next.questions?.[0]?.question).toBe("Scope?");
    expect(next.questions?.[0]?.suggestions).toEqual(["Small", "Medium"]);
  });

  it("opens PR workflow when git includes a prUrl", async () => {
    const { db, set } = mockDb();
    const run = baseRun({
      workflowStage: "pr_open",
      status: "running",
      pr: { status: "opening" },
    });
    const next = await applyWorkflowRunSnapshot(db, run, {
      status: "finished",
      git: { branches: [{ prUrl: "https://github.com/org/repo/pull/9" }] },
    });
    expect(next.pr?.url).toBe("https://github.com/org/repo/pull/9");
    expect(next.pr?.status).toBe("pr_open");
    expect(next.workflowStage).toBe("pr_open");
  });

  it("stores build plan when planning stage finishes", async () => {
    const { db, set } = mockDb();
    const run = baseRun({
      workflowStage: "planning",
      status: "running",
      buildPlan: null,
    });
    const next = await applyWorkflowRunSnapshot(db, run, {
      status: "finished",
      result: "# Plan\n\nDo the thing.",
    });
    expect(next.buildPlan).toBe("# Plan\n\nDo the thing.");
    expect(next.workflowStage).toBe("plan_approval");
  });
});
