/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { buildPrIdeaPrompt, normalizeRunInputs } from "@/lib/cursor/idea-runs";

describe("normalizeRunInputs", () => {
  it("never returns explicit undefined values when fields are missing", () => {
    const inputs = normalizeRunInputs({ mode: "issue", issueNumber: "12" });
    for (const [key, value] of Object.entries(inputs)) {
      expect(value).toBeDefined();
      expect(key).not.toBe("interests");
    }
    expect(inputs.mode).toBe("issue");
    expect(inputs.issueNumber).toBe("12");
    expect("interests" in inputs).toBe(false);
    expect("skills" in inputs).toBe(false);
  });

  it("keeps the values that were set", () => {
    const inputs = normalizeRunInputs({
      mode: "idea",
      interests: "react",
      preferredArea: "ui",
    });
    expect(inputs.mode).toBe("idea");
    expect(inputs.interests).toBe("react");
    expect(inputs.preferredArea).toBe("ui");
    expect("skills" in inputs).toBe(false);
  });

  it("treats whitespace-only strings as unset", () => {
    const inputs = normalizeRunInputs({ mode: "idea", interests: "   " });
    expect("interests" in inputs).toBe(false);
  });
});

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
