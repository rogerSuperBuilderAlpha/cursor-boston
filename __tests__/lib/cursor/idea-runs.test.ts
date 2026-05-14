/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { buildPrIdeaPrompt } from "@/lib/cursor/idea-runs";

describe("Cursor idea run prompts", () => {
  it("builds an issue-mode prompt with the selected issue and user context", () => {
    const prompt = buildPrIdeaPrompt({
      mode: "issue",
      issueNumber: "123",
      issueTitle: "Improve onboarding",
      issueUrl: "https://github.com/org/repo/issues/123",
      issueLabels: "good first issue,frontend",
      issueBody: "Make the first-run experience clearer.",
      freeform: "Keep it small and UI-focused.",
    });

    expect(prompt).toContain("Selected GitHub issue:");
    expect(prompt).toContain("#123 Improve onboarding");
    expect(prompt).toContain("cloud-agent-dev");
    expect(prompt).toContain("Make the first-run experience clearer.");
    expect(prompt).toContain("Keep it small and UI-focused.");
    expect(prompt).toContain("Return 2-4 concrete");
  });
});
