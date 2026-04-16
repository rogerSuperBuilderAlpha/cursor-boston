/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getGithubRepoWebBaseUrl } from "@/lib/github-recent-merged-prs";

/** Base branch for maintainer applications (PRs target this branch). */
export const MAINTAINER_APPLICATION_BRANCH = "maintainer-application";

/** Application JSON schema version stored in each file. */
export const MAINTAINER_APPLICATION_SCHEMA_VERSION = 1 as const;

export type MaintainerApplicationSchemaVersion =
  typeof MAINTAINER_APPLICATION_SCHEMA_VERSION;

/**
 * Payload submitted as a single JSON file in a PR to {@link MAINTAINER_APPLICATION_BRANCH}.
 * `githubLogin` and `discordUsername` must match the connections on cursorboston.com.
 */
export interface MaintainerApplicationPayload {
  schemaVersion: MaintainerApplicationSchemaVersion;
  githubLogin: string;
  discordUsername: string;
  displayName: string;
  siteEmail: string | null;
  whyMaintainer: string;
  relevantExperience: string;
  availability: string;
  agreedToCodeOfConduct: boolean;
  /** ISO 8601 timestamp when you open the PR (update right before pushing). */
  submittedAt: string;
}

export function getMaintainerApplicationRepoBaseUrl(): string {
  return getGithubRepoWebBaseUrl();
}

export function getMaintainerApplicationBranchTreeUrl(): string {
  return `${getMaintainerApplicationRepoBaseUrl()}/tree/${MAINTAINER_APPLICATION_BRANCH}`;
}

/** Path of the JSON file in the repo (root-relative, POSIX). */
export function getMaintainerApplicationFilePath(githubLogin: string): string {
  const safe = githubLogin.trim().replace(/[^a-zA-Z0-9._-]/g, "-") || "github-username";
  return `maintainer-applications/${safe}.json`;
}

export function buildMaintainerApplicationDraft(input: {
  githubLogin: string;
  discordUsername: string;
  displayName: string;
  siteEmail: string | null;
}): MaintainerApplicationPayload {
  return {
    schemaVersion: MAINTAINER_APPLICATION_SCHEMA_VERSION,
    githubLogin: input.githubLogin,
    discordUsername: input.discordUsername,
    displayName: input.displayName,
    siteEmail: input.siteEmail,
    whyMaintainer: "",
    relevantExperience: "",
    availability: "",
    agreedToCodeOfConduct: false,
    submittedAt: new Date().toISOString(),
  };
}

export function formatMaintainerApplicationJson(payload: MaintainerApplicationPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
