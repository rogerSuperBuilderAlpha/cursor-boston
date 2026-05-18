/**
 * @jest-environment node
 *
 * Coverage push #53 — lib/cursor/cloud-agents.ts. Covers the testable
 * surface of the Cursor SDK wrapper:
 *
 *  - MissingCursorConnectionError class
 *  - getCursorApiKeyForUser (Firestore read + decrypt)
 *  - launchPrIdeaRun / launchCursorAgentRun (Agent.create + send)
 *  - sendCursorFollowUp (Agent.resume + send)
 *  - cancelCursorRun / archiveCursorAgent / unarchiveCursorAgent / deleteCursorAgent
 *  - getCursorRunSnapshot (read + conversation + artifacts)
 *  - mapRunStatus (pure switch)
 *  - firstPrUrlFromGit (pure helper)
 */

const mockAgentCreate = jest.fn();
const mockAgentResume = jest.fn();
const mockAgentGetRun = jest.fn();
const mockAgentGet = jest.fn();
const mockAgentCancelRun = jest.fn();
const mockAgentArchive = jest.fn();
const mockAgentUnarchive = jest.fn();
const mockAgentDelete = jest.fn();

jest.mock("@cursor/sdk", () => ({
  __esModule: true,
  Agent: {
    create: (...a: unknown[]) => mockAgentCreate(...a),
    resume: (...a: unknown[]) => mockAgentResume(...a),
    getRun: (...a: unknown[]) => mockAgentGetRun(...a),
    get: (...a: unknown[]) => mockAgentGet(...a),
    cancelRun: (...a: unknown[]) => mockAgentCancelRun(...a),
    archive: (...a: unknown[]) => mockAgentArchive(...a),
    unarchive: (...a: unknown[]) => mockAgentUnarchive(...a),
    delete: (...a: unknown[]) => mockAgentDelete(...a),
  },
}));

const mockDecrypt = jest.fn();
jest.mock("@/lib/cursor/encryption", () => ({
  decryptApiKey: (...a: unknown[]) => mockDecrypt(...a),
}));

import {
  MissingCursorConnectionError,
  archiveCursorAgent,
  cancelCursorRun,
  deleteCursorAgent,
  firstPrUrlFromGit,
  getCursorApiKeyForUser,
  getCursorRunSnapshot,
  launchCursorAgentRun,
  launchPrIdeaRun,
  mapRunStatus,
  sendCursorFollowUp,
  unarchiveCursorAgent,
} from "@/lib/cursor/cloud-agents";
import {
  makeDoc,
  makeFakeDb,
} from "@/__tests__/_helpers/firebase-admin-mock";

function buildAgent(opts: {
  agentId?: string;
  sendId?: string;
  listArtifacts?: jest.Mock;
} = {}) {
  return {
    agentId: opts.agentId ?? "agent-1",
    send: jest.fn().mockResolvedValue({ id: opts.sendId ?? "run-1" }),
    listArtifacts: opts.listArtifacts ?? jest.fn().mockResolvedValue([]),
    [Symbol.asyncDispose]: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  mockAgentCreate.mockReset();
  mockAgentResume.mockReset();
  mockAgentGetRun.mockReset();
  mockAgentGet.mockReset();
  mockAgentCancelRun.mockReset();
  mockAgentArchive.mockReset();
  mockAgentUnarchive.mockReset();
  mockAgentDelete.mockReset();
  mockDecrypt.mockReset();
  delete process.env.CURSOR_SNAPSHOT_DEBUG;
});

describe("MissingCursorConnectionError", () => {
  it("defaults to 'Cursor is not connected'", () => {
    const err = new MissingCursorConnectionError();
    expect(err.message).toBe("Cursor is not connected");
    expect(err.name).toBe("MissingCursorConnectionError");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts a custom message", () => {
    const err = new MissingCursorConnectionError("Custom");
    expect(err.message).toBe("Custom");
  });
});

describe("getCursorApiKeyForUser", () => {
  function dbWithSecret(secret: Record<string, unknown> | undefined) {
    // The function chains users/{uid}/secrets/cursor — easiest to mock by
    // hand instead of using the generic fakeDb shape.
    const get = jest.fn().mockResolvedValue({
      exists: secret !== undefined,
      data: () => secret,
    });
    const secretsDoc = { get };
    const secretsCollection = { doc: () => secretsDoc };
    const userDoc = { collection: () => secretsCollection };
    const usersCollection = { doc: () => userDoc };
    return { collection: jest.fn().mockReturnValue(usersCollection) } as unknown as Parameters<typeof getCursorApiKeyForUser>[0];
  }

  it("throws MissingCursorConnectionError when the secret doc is missing", async () => {
    const db = dbWithSecret(undefined);
    await expect(getCursorApiKeyForUser(db, "u1")).rejects.toBeInstanceOf(
      MissingCursorConnectionError,
    );
  });

  it("throws when the doc exists but apiKeyEncrypted is missing", async () => {
    const db = dbWithSecret({}); // exists but no apiKeyEncrypted
    await expect(getCursorApiKeyForUser(db, "u1")).rejects.toThrow(
      "Cursor secret is missing",
    );
  });

  it("decrypts and returns the api key on the happy path", async () => {
    mockDecrypt.mockReturnValueOnce("sk_test_123");
    const db = dbWithSecret({
      apiKeyEncrypted: { ciphertext: "x", iv: "y", authTag: "z" },
    });
    const out = await getCursorApiKeyForUser(db, "u1");
    expect(out).toBe("sk_test_123");
    expect(mockDecrypt).toHaveBeenCalledWith({
      ciphertext: "x",
      iv: "y",
      authTag: "z",
    });
  });
});

describe("launchCursorAgentRun + launchPrIdeaRun", () => {
  it("constructs the agent + sends prompt + returns cursorAgentUrl", async () => {
    const agent = buildAgent({ agentId: "ag-7", sendId: "rn-7" });
    mockAgentCreate.mockResolvedValueOnce(agent);
    const out = await launchCursorAgentRun("k", "do something", "ik-1");
    expect(mockAgentCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockAgentCreate.mock.calls[0][0];
    expect(createArgs.apiKey).toBe("k");
    expect(createArgs.cloud.autoCreatePR).toBe(false);
    expect(createArgs.idempotencyKey).toBe("ik-1");
    expect(agent.send).toHaveBeenCalledWith("do something", {
      idempotencyKey: "ik-1:run",
    });
    expect(out).toEqual({
      cursorAgentId: "ag-7",
      cursorRunId: "rn-7",
      cursorAgentUrl: "https://cursor.com/agents?id=ag-7",
    });
    expect(agent[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  it("encodes the agent id in the URL", async () => {
    const agent = buildAgent({ agentId: "a id/with space" });
    mockAgentCreate.mockResolvedValueOnce(agent);
    const out = await launchCursorAgentRun("k", "p", "ik");
    expect(out.cursorAgentUrl).toBe(
      "https://cursor.com/agents?id=a%20id%2Fwith%20space",
    );
  });

  it("honors the options.autoCreatePR override", async () => {
    mockAgentCreate.mockResolvedValueOnce(buildAgent());
    await launchCursorAgentRun("k", "p", "ik", { autoCreatePR: true });
    expect(mockAgentCreate.mock.calls[0][0].cloud.autoCreatePR).toBe(true);
  });

  it("disposes the agent even if send() throws", async () => {
    const agent = buildAgent();
    agent.send = jest.fn().mockRejectedValueOnce(new Error("boom"));
    mockAgentCreate.mockResolvedValueOnce(agent);
    await expect(launchCursorAgentRun("k", "p", "ik")).rejects.toThrow("boom");
    expect(agent[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  it("launchPrIdeaRun delegates with name='Cursor Boston PR idea explorer'", async () => {
    mockAgentCreate.mockResolvedValueOnce(buildAgent());
    await launchPrIdeaRun("k", "find bugs", "ik");
    expect(mockAgentCreate.mock.calls[0][0].name).toBe(
      "Cursor Boston PR idea explorer",
    );
  });
});

describe("sendCursorFollowUp", () => {
  it("resumes the agent + sends follow-up prompt + returns runId", async () => {
    const agent = buildAgent({ sendId: "rn-2" });
    mockAgentResume.mockResolvedValueOnce(agent);
    const out = await sendCursorFollowUp("k", "ag-1", "next step", "ik-2");
    expect(mockAgentResume).toHaveBeenCalledWith("ag-1", expect.anything());
    expect(agent.send).toHaveBeenCalledWith("next step", { idempotencyKey: "ik-2" });
    expect(out).toEqual({ cursorRunId: "rn-2" });
  });

  it("disposes the agent even if send() throws", async () => {
    const agent = buildAgent();
    agent.send = jest.fn().mockRejectedValueOnce(new Error("boom"));
    mockAgentResume.mockResolvedValueOnce(agent);
    await expect(sendCursorFollowUp("k", "ag", "p", "ik")).rejects.toThrow("boom");
    expect(agent[Symbol.asyncDispose]).toHaveBeenCalled();
  });
});

describe("getCursorRunSnapshot", () => {
  function buildRun(overrides: Record<string, unknown> = {}) {
    return {
      id: "rn-1",
      status: "running" as const,
      result: undefined,
      git: undefined,
      durationMs: 1234,
      supports: jest.fn().mockReturnValue(true),
      conversation: jest.fn().mockResolvedValue([]),
      unsupportedReason: jest.fn().mockReturnValue(null),
      ...overrides,
    };
  }

  it("returns a populated snapshot with mapped status, activity, agentInfo + artifacts", async () => {
    const run = buildRun({
      conversation: jest.fn().mockResolvedValue([
        {
          type: "agentConversationTurn",
          turn: {
            steps: [
              { type: "agentMessage", message: { text: "Hi there" } },
            ],
          },
        },
      ]),
    });
    mockAgentGetRun.mockResolvedValueOnce(run);
    mockAgentGet.mockResolvedValueOnce({
      status: "running",
      summary: "Working on PR",
      archived: false,
    });
    const resumeAgent = buildAgent({
      listArtifacts: jest.fn().mockResolvedValue([
        { path: "diff.patch", sizeBytes: 200, updatedAt: 100 },
      ]),
    });
    mockAgentResume.mockResolvedValueOnce(resumeAgent);
    const out = await getCursorRunSnapshot("k", "ag-1", "rn-1");
    expect(out.status).toBe("running");
    expect(out.activity).toHaveLength(1);
    expect(out.activity?.[0].summary).toContain("Hi there");
    expect(out.artifacts).toEqual([
      { path: "diff.patch", sizeBytes: 200, updatedAt: 100 },
    ]);
    expect(out.cursorStatusDetail).toContain("Agent running");
    expect(resumeAgent[Symbol.asyncDispose]).toHaveBeenCalled();
  });

  it("falls back when conversation throws and surfaces the warning detail", async () => {
    const run = buildRun({
      conversation: jest.fn().mockRejectedValueOnce(new Error("log err")),
    });
    mockAgentGetRun.mockResolvedValueOnce(run);
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const out = await getCursorRunSnapshot("k", "ag-1", "rn-1");
    expect(out.cursorStatusDetail).toContain("Open Cursor");
    warnSpy.mockRestore();
  });

  it("uses unsupportedReason when conversation is unsupported", async () => {
    const run = buildRun({
      supports: jest.fn().mockReturnValue(false),
      unsupportedReason: jest.fn().mockReturnValue("legacy run"),
    });
    mockAgentGetRun.mockResolvedValueOnce(run);
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const out = await getCursorRunSnapshot("k", "ag-1", "rn-1");
    expect(out.cursorStatusDetail).toBe("legacy run");
  });

  it("emits a debug log line when CURSOR_SNAPSHOT_DEBUG=1", async () => {
    process.env.CURSOR_SNAPSHOT_DEBUG = "1";
    const run = buildRun();
    mockAgentGetRun.mockResolvedValueOnce(run);
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    await getCursorRunSnapshot("k", "ag-1", "rn-1");
    expect(infoSpy).toHaveBeenCalledWith(
      "[cursor.snapshot]",
      expect.objectContaining({ cursorAgentId: "ag-1" }),
    );
    infoSpy.mockRestore();
  });

  it("snapshot returns no artifacts when Agent.resume throws (best-effort)", async () => {
    const run = buildRun();
    mockAgentGetRun.mockResolvedValueOnce(run);
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockRejectedValueOnce(new Error("resume failed"));
    const out = await getCursorRunSnapshot("k", "ag-1", "rn-1");
    expect(out.artifacts).toBeUndefined();
    expect(out.status).toBe("running");
  });
});

describe("conversation activity normalizers (private but exercised via snapshot)", () => {
  function buildRun(conversation: unknown[]) {
    return {
      id: "rn",
      status: "running" as const,
      durationMs: 0,
      supports: () => true,
      conversation: jest.fn().mockResolvedValue(conversation),
      unsupportedReason: () => null,
    };
  }

  it("turns shell command turns into 'Running shell command' summaries", async () => {
    mockAgentGetRun.mockResolvedValueOnce(
      buildRun([
        {
          type: "shellConversationTurn",
          turn: { shellCommand: { command: "ls -la" } },
        },
      ]),
    );
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const out = await getCursorRunSnapshot("k", "ag", "rn");
    expect(out.activity?.[0].kind).toBe("shell");
    expect(out.activity?.[0].summary).toContain("ls -la");
  });

  it("falls through to shell stdout summary when no command is present", async () => {
    mockAgentGetRun.mockResolvedValueOnce(
      buildRun([
        {
          type: "shellConversationTurn",
          turn: { shellOutput: { stdout: "hello\nworld" } },
        },
      ]),
    );
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const out = await getCursorRunSnapshot("k", "ag", "rn");
    expect(out.activity?.[0].summary).toContain("hello");
  });

  it("renders toolCall steps as 'Using tool: <type>'", async () => {
    mockAgentGetRun.mockResolvedValueOnce(
      buildRun([
        {
          type: "agentConversationTurn",
          turn: {
            steps: [{ type: "toolCall", message: { type: "shell" } }],
          },
        },
      ]),
    );
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const out = await getCursorRunSnapshot("k", "ag", "rn");
    expect(out.activity?.[0].kind).toBe("tool");
    expect(out.activity?.[0].summary).toContain("shell");
  });

  it("renders thinking-style steps as 'Thinking through the next step'", async () => {
    mockAgentGetRun.mockResolvedValueOnce(
      buildRun([
        {
          type: "agentConversationTurn",
          turn: {
            steps: [{ type: "modelThinking" }],
          },
        },
      ]),
    );
    mockAgentGet.mockResolvedValueOnce(null);
    mockAgentResume.mockResolvedValueOnce(buildAgent());
    const out = await getCursorRunSnapshot("k", "ag", "rn");
    expect(out.activity?.[0].kind).toBe("thinking");
  });
});

describe("cancel / archive / unarchive / delete", () => {
  it("cancelCursorRun calls Agent.cancelRun with the right args", async () => {
    mockAgentCancelRun.mockResolvedValueOnce(undefined);
    await cancelCursorRun("k", "ag", "rn");
    expect(mockAgentCancelRun).toHaveBeenCalledWith("rn", {
      runtime: "cloud",
      agentId: "ag",
      apiKey: "k",
    });
  });

  it("archiveCursorAgent calls Agent.archive", async () => {
    mockAgentArchive.mockResolvedValueOnce(undefined);
    await archiveCursorAgent("k", "ag");
    expect(mockAgentArchive).toHaveBeenCalledWith("ag", { apiKey: "k" });
  });

  it("unarchiveCursorAgent calls Agent.unarchive", async () => {
    mockAgentUnarchive.mockResolvedValueOnce(undefined);
    await unarchiveCursorAgent("k", "ag");
    expect(mockAgentUnarchive).toHaveBeenCalledWith("ag", { apiKey: "k" });
  });

  it("deleteCursorAgent calls Agent.delete", async () => {
    mockAgentDelete.mockResolvedValueOnce(undefined);
    await deleteCursorAgent("k", "ag");
    expect(mockAgentDelete).toHaveBeenCalledWith("ag", { apiKey: "k" });
  });
});

describe("mapRunStatus", () => {
  it("maps every known RunStatus to a CursorIdeaRunStatus", () => {
    expect(mapRunStatus("running")).toBe("running");
    expect(mapRunStatus("finished")).toBe("finished");
    expect(mapRunStatus("cancelled")).toBe("cancelled");
    expect(mapRunStatus("error")).toBe("error");
  });
});

describe("firstPrUrlFromGit", () => {
  it("returns the first branch's prUrl when present", () => {
    expect(
      firstPrUrlFromGit({
        branches: [{ prUrl: "" }, { prUrl: "https://github.com/x/pull/1" }],
      }),
    ).toBe("https://github.com/x/pull/1");
  });

  it("returns null when no branch has a prUrl", () => {
    expect(firstPrUrlFromGit({ branches: [{}, { prUrl: "" }] })).toBeNull();
    expect(firstPrUrlFromGit({ branches: [] })).toBeNull();
  });

  it("returns null when git is undefined or branches isn't an array", () => {
    expect(firstPrUrlFromGit(undefined)).toBeNull();
    expect(firstPrUrlFromGit({ branches: "not-array" })).toBeNull();
    expect(firstPrUrlFromGit(null)).toBeNull();
  });
});

// Silence unused-import warnings — keep the helpers imported so this test
// file documents the surface available to other coverage pushes that pivot
// to lib/cursor/*.
void makeDoc;
void makeFakeDb;
