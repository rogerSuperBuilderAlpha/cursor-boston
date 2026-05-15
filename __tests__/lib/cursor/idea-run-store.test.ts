/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { serializeCursorIdeaRun } from "@/lib/cursor/idea-run-store";
import { CursorIdeaRunRecord } from "@/lib/cursor/idea-runs";

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

describe("serializeCursorIdeaRun", () => {
  it("resolves a serverTimestamp sentinel to an ISO string so UI gates do not see null", () => {
    const run = baseRun({
      planApprovedAt: FieldValue.serverTimestamp() as unknown as CursorIdeaRunRecord["planApprovedAt"],
      workflowStage: "building",
    });
    const serialized = serializeCursorIdeaRun(run);
    expect(typeof serialized.planApprovedAt).toBe("string");
    expect(serialized.planApprovedAt).not.toBeNull();
    expect(() => new Date(serialized.planApprovedAt as string).toISOString()).not.toThrow();
  });

  it("keeps null timestamps as null", () => {
    const run = baseRun({ planApprovedAt: null });
    expect(serializeCursorIdeaRun(run).planApprovedAt).toBeNull();
  });

  it("converts Firestore Timestamp to ISO string", () => {
    const run = baseRun({
      planApprovedAt: Timestamp.fromDate(new Date("2026-02-03T04:05:06Z")),
    });
    expect(serializeCursorIdeaRun(run).planApprovedAt).toBe("2026-02-03T04:05:06.000Z");
  });
});
