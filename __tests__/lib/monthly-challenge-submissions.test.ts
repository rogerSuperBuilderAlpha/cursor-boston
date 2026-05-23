import {
  activeChallengeSubmissionStatuses,
  isActiveChallengeSubmissionStatus,
  isMonthlyChallengeSubmissionWindowOpen,
  normalizeMonthlyChallengeSubmission,
  sanitizeChallengeId,
} from "@/lib/monthly-challenge-submissions";

const OPEN_AT = "2026-05-01T00:00:00.000Z";
const CLOSE_AT = "2026-05-31T23:59:59.000Z";

describe("monthly challenge submission helpers", () => {
  it("validates safe challenge ids", () => {
    expect(sanitizeChallengeId("may-2026")).toBe("may-2026");
    expect(sanitizeChallengeId("../may-2026")).toBeNull();
  });

  it("detects active submission statuses", () => {
    expect(activeChallengeSubmissionStatuses()).toContain("submitted");
    expect(isActiveChallengeSubmissionStatus("eligible")).toBe(true);
    expect(isActiveChallengeSubmissionStatus("withdrawn")).toBe(false);
  });

  it("opens the submission window only for open challenges inside the window", () => {
    expect(
      isMonthlyChallengeSubmissionWindowOpen(
        {
          status: "open",
          submissionOpenAt: OPEN_AT,
          submissionCloseAt: CLOSE_AT,
        },
        new Date("2026-05-15T12:00:00.000Z")
      )
    ).toBe(true);

    expect(
      isMonthlyChallengeSubmissionWindowOpen(
        {
          status: "judging",
          submissionOpenAt: OPEN_AT,
          submissionCloseAt: CLOSE_AT,
        },
        new Date("2026-05-15T12:00:00.000Z")
      )
    ).toBe(false);

    expect(
      isMonthlyChallengeSubmissionWindowOpen(
        {
          status: "open",
          submissionOpenAt: OPEN_AT,
          submissionCloseAt: CLOSE_AT,
        },
        new Date("2026-06-01T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("normalizes a valid draft submission", () => {
    const result = normalizeMonthlyChallengeSubmission({
      title: "Build a prompt debugger",
      summary: "A tool that helps members compare prompt behavior across models.",
      repositoryUrl: " https://github.com/example/prompt-debugger ",
      demoUrl: "https://example.com/demo",
      writeup:
        "This submission explains the architecture, tradeoffs, and how the debugging flow helps prompt authors.",
      cursorWorkflow:
        "Cursor was used to inspect existing examples, generate tests, and iterate on the debugger UI.",
    });

    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      title: "Build a prompt debugger",
      repositoryUrl: "https://github.com/example/prompt-debugger",
      demoUrl: "https://example.com/demo",
      status: "draft",
    });
  });

  it("sets submitted status when submitNow is true", () => {
    const result = normalizeMonthlyChallengeSubmission({
      title: "Build a prompt debugger",
      summary: "A tool that helps members compare prompt behavior across models.",
      writeup:
        "This submission explains the architecture, tradeoffs, and how the debugging flow helps prompt authors.",
      cursorWorkflow:
        "Cursor was used to inspect existing examples, generate tests, and iterate on the debugger UI.",
      submitNow: true,
    });

    expect(result.data?.status).toBe("submitted");
  });

  it("rejects invalid repository and demo URLs", () => {
    const result = normalizeMonthlyChallengeSubmission({
      title: "Build a prompt debugger",
      summary: "A tool that helps members compare prompt behavior across models.",
      repositoryUrl: "https://example.com/not-github",
      demoUrl: "javascript:alert(1)",
      writeup:
        "This submission explains the architecture, tradeoffs, and how the debugging flow helps prompt authors.",
      cursorWorkflow:
        "Cursor was used to inspect existing examples, generate tests, and iterate on the debugger UI.",
    });

    expect(result.errors).toContain("repositoryUrl must point to a GitHub repository.");
    expect(result.errors).toContain("demoUrl must be an http or https URL.");
  });

  it("rejects too-short required text", () => {
    const result = normalizeMonthlyChallengeSubmission({
      title: "No",
      summary: "Too short",
      writeup: "short",
      cursorWorkflow: "short",
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Title must be at least 3 characters.",
        "Summary must be at least 20 characters.",
        "Writeup must be at least 50 characters.",
        "Cursor workflow note must be at least 20 characters.",
      ])
    );
  });
});
