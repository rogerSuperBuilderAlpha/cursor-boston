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

describe("serializeCursorIdeaRun timestamp handling", () => {
  it("approximates a FieldValue sentinel by stamping 'now' (object branch)", () => {
    // Use a plain object that's NOT a Timestamp and NOT a Date — the sentinel
    // catch-all branch (line 281). The real FieldValue sentinel value may be
    // a class that confuses instanceof checks across module boundaries, so
    // we approximate with a plain object that hits the same `typeof === "object"`
    // branch.
    const sentinel = { __ts: "sentinel" } as never;
    const run = baseRun({
      planApprovedAt: sentinel,
      updatedAt: sentinel,
    } as never);
    const out = serializeCursorIdeaRun(run);
    // Should not be undefined / null — should be an ISO-8601 string
    expect(typeof out.planApprovedAt).toBe("string");
    expect(out.planApprovedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof out.updatedAt).toBe("string");
  });

  it("passes through string timestamps unchanged", () => {
    const run = baseRun({
      planApprovedAt: "2026-04-01T12:00:00.000Z" as never,
    } as never);
    const out = serializeCursorIdeaRun(run);
    expect(out.planApprovedAt).toBe("2026-04-01T12:00:00.000Z");
  });

  it("serializes a Date instance to ISO string", () => {
    const run = baseRun({
      planApprovedAt: new Date("2026-05-01T08:00:00.000Z") as never,
    } as never);
    const out = serializeCursorIdeaRun(run);
    expect(out.planApprovedAt).toBe("2026-05-01T08:00:00.000Z");
  });

  it("preserves null timestamps as null (distinct from undefined)", () => {
    const run = baseRun({
      planApprovedAt: null as never,
    } as never);
    const out = serializeCursorIdeaRun(run);
    expect(out.planApprovedAt).toBeNull();
  });
});

describe("extractQuestionsFromText (via applyRunSnapshot)", () => {
  it("ignores malformed JSON inside [...] braces (catch branch)", async () => {
    const { db, set } = mockDb();
    const run = baseRun({
      workflowStage: "questions",
      status: "running",
      questions: [],
    });
    // The result text has [ ... ] but the content inside is unparseable
    const snapshot: CursorRunSnapshot = {
      status: "finished",
      result: "Here are the questions: [ {not valid json },, ]",
    } as never;
    const next = await applyWorkflowRunSnapshot(db, run, snapshot);
    // Should still be valid, just questions stays empty
    expect(next.questions).toEqual([]);
  });

  it("ignores result with no array brackets at all", async () => {
    const { db } = mockDb();
    const run = baseRun({
      workflowStage: "questions",
      status: "running",
      questions: [],
    });
    const snapshot: CursorRunSnapshot = {
      status: "finished",
      result: "I have no questions in this output.",
    } as never;
    const next = await applyWorkflowRunSnapshot(db, run, snapshot);
    expect(next.questions).toEqual([]);
  });

  it("parses a valid questions array and clamps to 5 items", async () => {
    const { db } = mockDb();
    const run = baseRun({
      workflowStage: "questions",
      status: "running",
      questions: [],
    });
    const questionsJson = JSON.stringify(
      Array.from({ length: 7 }, (_, i) => ({
        id: `q${i}`,
        question: `Question ${i}?`,
        suggestions: [`s${i}`],
      })),
    );
    const snapshot: CursorRunSnapshot = {
      status: "finished",
      result: `Reasoning…\n\n${questionsJson}`,
    } as never;
    const next = await applyWorkflowRunSnapshot(db, run, snapshot);
    expect(next.questions).toHaveLength(5);
  });
});
