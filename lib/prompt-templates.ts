/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/** @internal */
export interface PromptTemplateVariant {
  id: string;
  stack: string;
  useCase: string;
  prompt: string;
  notes: string[];
}

/** @internal */
export interface PromptTemplate {
  id: string;
  title: string;
  summary: string;
  category: "debugging" | "planning" | "refactoring";
  difficulty: "Beginner" | "Intermediate";
  placeholders: string[];
  basePrompt: string;
  variants: PromptTemplateVariant[];
}

export const PROMPT_TEMPLATE_CATEGORIES: Record<
  PromptTemplate["category"],
  string
> = {
  debugging: "Debugging",
  planning: "Planning",
  refactoring: "Refactoring",
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "bug-reproduction-brief",
    title: "Bug Reproduction Brief",
    summary:
      "Turn a vague bug report into a minimal reproduction plan, likely causes, and targeted files to inspect.",
    category: "debugging",
    difficulty: "Beginner",
    placeholders: [
      "BUG_SUMMARY",
      "EXPECTED_BEHAVIOR",
      "ACTUAL_BEHAVIOR",
      "RELEVANT_STACK",
    ],
    basePrompt: `You are helping me debug a production issue.

Bug summary:
{{BUG_SUMMARY}}

Expected behavior:
{{EXPECTED_BEHAVIOR}}

Actual behavior:
{{ACTUAL_BEHAVIOR}}

Relevant stack:
{{RELEVANT_STACK}}

Please produce:
1. A minimal reproduction checklist.
2. The most likely files or modules to inspect first.
3. Three hypotheses ranked by probability.
4. A focused test plan that can prove or disprove each hypothesis.`,
    variants: [
      {
        id: "next-firebase",
        stack: "Next.js + Firebase",
        useCase: "Client/server auth or Firestore data bugs",
        prompt: `Use this repo context as a Next.js App Router + Firebase app.

Issue:
{{BUG_SUMMARY}}

Expected:
{{EXPECTED_BEHAVIOR}}

Actual:
{{ACTUAL_BEHAVIOR}}

Inspect likely boundaries across route handlers, Firebase client calls, server auth helpers, Firestore rules, and React state. Return a reproduction checklist, likely files, and the smallest Jest or Playwright test that should fail before the fix.`,
        notes: [
          "Call out whether the bug is likely client state, route-handler auth, or Firestore rule behavior.",
          "Prefer focused Jest for route/data logic and Playwright only for browser-only flows.",
        ],
      },
      {
        id: "python-django",
        stack: "Python + Django",
        useCase: "View, form, and ORM behavior bugs",
        prompt: `Use this as a Django debugging brief.

Bug:
{{BUG_SUMMARY}}

Expected:
{{EXPECTED_BEHAVIOR}}

Actual:
{{ACTUAL_BEHAVIOR}}

Identify the smallest failing request or model operation, the view/form/model boundary most likely involved, and the focused pytest cases needed for the reproduction.`,
        notes: [
          "Ask Cursor to inspect migrations when the symptom involves missing fields or unexpected defaults.",
          "Include permission and queryset hypotheses before changing view logic.",
        ],
      },
    ],
  },
  {
    id: "feature-slice-planner",
    title: "Feature Slice Planner",
    summary:
      "Convert a broad feature idea into incremental PR slices with clear contracts, tests, and risk boundaries.",
    category: "planning",
    difficulty: "Beginner",
    placeholders: [
      "FEATURE_GOAL",
      "USER_JOURNEY",
      "EXISTING_SURFACES",
      "KNOWN_CONSTRAINTS",
    ],
    basePrompt: `I want to ship this feature safely.

Feature goal:
{{FEATURE_GOAL}}

Primary user journey:
{{USER_JOURNEY}}

Existing surfaces to reuse:
{{EXISTING_SURFACES}}

Known constraints:
{{KNOWN_CONSTRAINTS}}

Break this into 3-5 PR slices. For each slice include scope, files likely touched, tests, rollout risk, and what should explicitly stay out of scope.`,
    variants: [
      {
        id: "community-product",
        stack: "Community Product",
        useCase: "Member-facing features in a community app",
        prompt: `Act as a pragmatic product engineer. Break the feature below into PRs that each create visible user value without overbuilding data contracts.

Goal:
{{FEATURE_GOAL}}

Journey:
{{USER_JOURNEY}}

Existing app surfaces:
{{EXISTING_SURFACES}}

Constraints:
{{KNOWN_CONSTRAINTS}}

Return a staged plan with one read-only or low-risk first slice, one persistence/API slice if needed, and one polish/observability slice.`,
        notes: [
          "Useful when the issue asks for APIs but the data model is not settled yet.",
          "Keeps early PRs reviewable while still moving the feature forward.",
        ],
      },
      {
        id: "saas-dashboard",
        stack: "SaaS Dashboard",
        useCase: "Operational workflow additions",
        prompt: `Plan this dashboard feature as small operational increments.

Feature:
{{FEATURE_GOAL}}

Workflow:
{{USER_JOURNEY}}

Current modules:
{{EXISTING_SURFACES}}

Constraints:
{{KNOWN_CONSTRAINTS}}

Prioritize dense, scan-friendly UI, deterministic server contracts, audit-friendly state changes, and tests at the API plus component boundary.`,
        notes: [
          "Ask for empty, loading, permission-denied, and partial-data states in the first UI slice.",
          "Useful for admin dashboards and repeated workflow screens.",
        ],
      },
    ],
  },
  {
    id: "refactor-safety-review",
    title: "Refactor Safety Review",
    summary:
      "Ask Cursor to identify behavior-preserving refactor risks before touching shared modules.",
    category: "refactoring",
    difficulty: "Intermediate",
    placeholders: [
      "CURRENT_MODULE",
      "REFACTOR_GOAL",
      "CALLERS",
      "TESTS_AVAILABLE",
    ],
    basePrompt: `I am planning a behavior-preserving refactor.

Current module:
{{CURRENT_MODULE}}

Refactor goal:
{{REFACTOR_GOAL}}

Known callers:
{{CALLERS}}

Existing tests:
{{TESTS_AVAILABLE}}

Before writing code, identify the invariants that must not change, missing tests to add first, migration steps, and rollback risks.`,
    variants: [
      {
        id: "typescript-shared-lib",
        stack: "TypeScript Shared Library",
        useCase: "Extracting helpers used across app routes and components",
        prompt: `Review this TypeScript refactor plan for shared-library risk.

Module:
{{CURRENT_MODULE}}

Goal:
{{REFACTOR_GOAL}}

Callers:
{{CALLERS}}

Tests:
{{TESTS_AVAILABLE}}

List type-level invariants, runtime behavior invariants, import-cycle risks, and the minimum test matrix before code changes.`,
        notes: [
          "Helps prevent broad helper refactors from changing response text or error semantics.",
          "Ask for caller categories rather than a single happy-path test.",
        ],
      },
      {
        id: "react-component-split",
        stack: "React Component Split",
        useCase: "Breaking up large UI components",
        prompt: `Evaluate this React component split before implementation.

Component:
{{CURRENT_MODULE}}

Goal:
{{REFACTOR_GOAL}}

Callers:
{{CALLERS}}

Tests:
{{TESTS_AVAILABLE}}

Identify prop boundaries, state that should stay colocated, accessibility behaviors that must be preserved, and RTL tests that should be added before the split.`,
        notes: [
          "Use this before decomposing page components with forms, modals, or keyboard behavior.",
          "Keep state ownership explicit so the split does not create sync bugs.",
        ],
      },
    ],
  },
];

export function getPromptTemplateById(id: string): PromptTemplate | null {
  return PROMPT_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function getTemplateStacks(): string[] {
  const stacks = new Set<string>();
  for (const template of PROMPT_TEMPLATES) {
    for (const variant of template.variants) {
      stacks.add(variant.stack);
    }
  }
  return [...stacks].sort((a, b) => a.localeCompare(b));
}

export function getTemplatePlaceholderTokens(template: PromptTemplate): string[] {
  const tokens = new Set(template.placeholders);
  const pattern = /\{\{([A-Z0-9_]+)\}\}/g;
  for (const prompt of [
    template.basePrompt,
    ...template.variants.map((variant) => variant.prompt),
  ]) {
    for (const match of prompt.matchAll(pattern)) {
      tokens.add(match[1]);
    }
  }
  return [...tokens].sort((a, b) => a.localeCompare(b));
}
