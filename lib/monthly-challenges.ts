/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export interface ChallengeRubricItem {
  label: string;
  points: number;
  description: string;
}

export interface MonthlyChallenge {
  id: string;
  monthLabel: string;
  title: string;
  status: "current" | "archive";
  summary: string;
  theme: string;
  prompt: string;
  submissionWindow: string;
  maxLines: number;
  cursorSkills: string[];
  deliverables: string[];
  rubric: ChallengeRubricItem[];
}

export const MONTHLY_CHALLENGES: MonthlyChallenge[] = [
  {
    id: "2026-06-agentic-debugging",
    monthLabel: "June 2026",
    title: "Agentic Debugging Relay",
    status: "current",
    summary:
      "Build a tiny tool that turns failing logs into a ranked debugging plan and a reproducible test checklist.",
    theme: "AI-assisted debugging",
    prompt:
      "Create a command-line or web helper that accepts an error log plus project context, then returns a ranked set of hypotheses, files to inspect, and tests to run.",
    submissionWindow: "June 1-28, 2026",
    maxLines: 200,
    cursorSkills: [
      "Multi-file context gathering",
      "Test-first debugging",
      "Prompted hypothesis ranking",
    ],
    deliverables: [
      "A public GitHub repository or gist",
      "A README with setup and one example input/output",
      "A short note describing how Cursor helped build or debug it",
    ],
    rubric: [
      {
        label: "Reproducibility",
        points: 30,
        description: "A reviewer can run the example and verify the output.",
      },
      {
        label: "Cursor workflow",
        points: 25,
        description:
          "The submission shows a concrete Cursor-assisted debugging technique.",
      },
      {
        label: "Code focus",
        points: 25,
        description: "The solution stays under the line limit and avoids overbuilt infrastructure.",
      },
      {
        label: "Usefulness",
        points: 20,
        description: "The output would save time on a real debugging task.",
      },
    ],
  },
  {
    id: "2026-05-refactor-safety-net",
    monthLabel: "May 2026",
    title: "Refactor Safety Net",
    status: "archive",
    summary:
      "Design a small guardrail that makes behavior-preserving refactors easier to review.",
    theme: "Safe refactoring",
    prompt:
      "Build a helper, script, or test fixture that catches accidental behavior changes during a refactor.",
    submissionWindow: "May 1-31, 2026",
    maxLines: 200,
    cursorSkills: [
      "Refactor planning",
      "Regression-test generation",
      "Diff review",
    ],
    deliverables: [
      "A repository or gist with the guardrail",
      "Before/after examples",
      "A note on what Cursor helped identify",
    ],
    rubric: [
      {
        label: "Regression coverage",
        points: 35,
        description: "The guardrail catches a plausible refactor mistake.",
      },
      {
        label: "Review clarity",
        points: 25,
        description: "The output makes a reviewer faster and more confident.",
      },
      {
        label: "Simplicity",
        points: 20,
        description: "The solution is focused and easy to adopt.",
      },
      {
        label: "Cursor workflow",
        points: 20,
        description: "The writeup explains the AI-assisted refactor loop.",
      },
    ],
  },
];

export function getCurrentChallenge(): MonthlyChallenge {
  return (
    MONTHLY_CHALLENGES.find((challenge) => challenge.status === "current") ??
    MONTHLY_CHALLENGES[0]
  );
}

export function getChallengeById(id: string): MonthlyChallenge | null {
  return MONTHLY_CHALLENGES.find((challenge) => challenge.id === id) ?? null;
}

export function getChallengeRubricTotal(challenge: MonthlyChallenge): number {
  return challenge.rubric.reduce((total, item) => total + item.points, 0);
}

export function getChallengeIds(): string[] {
  return MONTHLY_CHALLENGES.map((challenge) => challenge.id);
}
