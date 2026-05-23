/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { sanitizeText } from "@/lib/sanitize";

export const PROMPT_TEMPLATES_COLLECTION = "promptTemplates";

export const PROMPT_TEMPLATE_PLACEHOLDER_RE = /^[a-z][a-z0-9_]{1,48}$/;
const PLACEHOLDER_TOKEN_RE = /{{\s*([^{}]+?)\s*}}/g;
const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_.\-]{12,}/i,
];

export type PromptTemplateModerationStatus = "draft" | "pending_review";
export type PromptTemplateVisibility = "private";

export interface PromptTemplatePlaceholderInput {
  name: string;
  label: string;
  description: string;
  required: boolean;
  example: string;
}

export interface PromptTemplateSubmissionInput {
  title: string;
  summary: string;
  category: string;
  useCase?: string;
  prompt: string;
  placeholders?: PromptTemplatePlaceholderInput[];
  tags?: string[];
  submitForReview?: boolean;
}

export interface NormalizedPromptTemplateSubmission {
  title: string;
  summary: string;
  category: string;
  useCase: string;
  prompt: string;
  placeholders: PromptTemplatePlaceholderInput[];
  tags: string[];
  moderationStatus: PromptTemplateModerationStatus;
  visibility: PromptTemplateVisibility;
}

export interface PromptTemplateSubmissionValidation {
  data: NormalizedPromptTemplateSubmission | null;
  errors: string[];
}

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function slugifyPromptTemplateTitle(title: string): string {
  const slug = sanitizeText(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "prompt-template";
}

export function extractPromptPlaceholders(prompt: string): {
  names: string[];
  invalidTokens: string[];
} {
  const names: string[] = [];
  const invalidTokens: string[] = [];
  for (const match of prompt.matchAll(PLACEHOLDER_TOKEN_RE)) {
    const token = match[1]?.trim() ?? "";
    if (PROMPT_TEMPLATE_PLACEHOLDER_RE.test(token)) {
      names.push(token);
    } else if (token) {
      invalidTokens.push(token);
    }
  }

  return {
    names: uniqueStrings(names).sort(),
    invalidTokens: uniqueStrings(invalidTokens).sort(),
  };
}

export function containsSensitivePromptText(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizePlaceholder(
  placeholder: PromptTemplatePlaceholderInput
): PromptTemplatePlaceholderInput {
  const name = sanitizeText(placeholder.name).toLowerCase();
  return {
    name,
    label: compactSpaces(sanitizeText(placeholder.label)).slice(0, 80),
    description: compactSpaces(sanitizeText(placeholder.description)).slice(0, 240),
    required: placeholder.required !== false,
    example: sanitizeText(placeholder.example).slice(0, 160),
  };
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return uniqueStrings(
    tags
      .map((tag) => sanitizeText(tag).toLowerCase().replace(/[^a-z0-9+.#-]+/g, "-"))
      .map((tag) => tag.replace(/^-+|-+$/g, ""))
      .filter((tag) => tag.length >= 2)
      .map((tag) => tag.slice(0, 40))
  ).slice(0, 10);
}

export function normalizePromptTemplateSubmission(
  input: PromptTemplateSubmissionInput
): PromptTemplateSubmissionValidation {
  const title = compactSpaces(sanitizeText(input.title)).slice(0, 120);
  const summary = compactSpaces(sanitizeText(input.summary)).slice(0, 500);
  const category = compactSpaces(sanitizeText(input.category)).slice(0, 64);
  const useCase = compactSpaces(sanitizeText(input.useCase || input.category)).slice(0, 120);
  const prompt = sanitizeText(input.prompt).slice(0, 8000);
  const tags = normalizeTags(input.tags);
  const errors: string[] = [];

  if (title.length < 3) errors.push("Title must be at least 3 characters.");
  if (summary.length < 10) errors.push("Summary must be at least 10 characters.");
  if (category.length < 2) errors.push("Category is required.");
  if (useCase.length < 2) errors.push("Use case is required.");
  if (prompt.length < 20) errors.push("Prompt must be at least 20 characters.");
  if (containsSensitivePromptText(prompt)) {
    errors.push("Prompt must not include secrets, tokens, or credentials.");
  }

  const extracted = extractPromptPlaceholders(prompt);
  if (extracted.invalidTokens.length > 0) {
    errors.push(
      `Invalid placeholder names: ${extracted.invalidTokens.join(", ")}. Use snake_case names like {{project_name}}.`
    );
  }

  const placeholders = (input.placeholders || []).map(normalizePlaceholder);
  const placeholderNames = placeholders.map((placeholder) => placeholder.name);
  const duplicateNames = placeholderNames.filter(
    (name, index) => placeholderNames.indexOf(name) !== index
  );
  if (duplicateNames.length > 0) {
    errors.push(`Duplicate placeholders: ${uniqueStrings(duplicateNames).join(", ")}.`);
  }

  for (const placeholder of placeholders) {
    if (!PROMPT_TEMPLATE_PLACEHOLDER_RE.test(placeholder.name)) {
      errors.push(`Invalid placeholder name: ${placeholder.name || "(blank)"}.`);
    }
    if (!placeholder.label) {
      errors.push(`Placeholder ${placeholder.name || "(blank)"} needs a label.`);
    }
    if (!placeholder.description) {
      errors.push(`Placeholder ${placeholder.name || "(blank)"} needs a description.`);
    }
    if (!placeholder.example) {
      errors.push(`Placeholder ${placeholder.name || "(blank)"} needs an example.`);
    }
  }

  const missingMetadata = extracted.names.filter((name) => !placeholderNames.includes(name));
  const staleMetadata = placeholderNames.filter((name) => !extracted.names.includes(name));
  if (missingMetadata.length > 0) {
    errors.push(`Placeholder metadata required for: ${missingMetadata.join(", ")}.`);
  }
  if (staleMetadata.length > 0) {
    errors.push(`Placeholder not found in prompt: ${staleMetadata.join(", ")}.`);
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      title,
      summary,
      category,
      useCase,
      prompt,
      placeholders,
      tags,
      moderationStatus: input.submitForReview === true ? "pending_review" : "draft",
      visibility: "private",
    },
    errors: [],
  };
}
