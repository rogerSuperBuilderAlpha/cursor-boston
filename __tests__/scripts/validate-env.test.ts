/**
 * @jest-environment node
 *
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { spawnSync } from "child_process";
import {
  optionalEnvVars,
  requiredEnvVars,
  validateEnvVar,
} from "@/scripts/validate-env";

const originalEnv = process.env;

const VALID_REQUIRED_ENV: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "actual-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "cursor-boston.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "cursor-boston-prod",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "cursor-boston.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:abcdef123456",
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: "https://cursor-boston.firebaseio.com",
  UNSUBSCRIBE_SECRET: "production-unsubscribe-secret-32-bytes",
};

const EXPECTED_ENV_VAR_NAMES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "UNSUBSCRIBE_SECRET",
  "NEXT_PUBLIC_DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "NEXT_PUBLIC_DISCORD_REDIRECT_URI",
  "CURSOR_BOSTON_DISCORD_SERVER_ID",
  "NEXT_PUBLIC_GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "NEXT_PUBLIC_GITHUB_REDIRECT_URI",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_REPO_OWNER",
  "GITHUB_REPO_NAME",
  "HACK_A_SPRINT_2026_JUDGE_UIDS",
  "HACK_A_SPRINT_2026_JUDGE_EMAILS",
  "HACK_A_SPRINT_2026_EVENT_PASSCODE",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "ADMIN_EMAIL",
  "SUMMER_COHORT_ADMIN_EMAILS",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
] as const;

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
  });
}

function getRequiredEnvVar(name: string) {
  const envVar = requiredEnvVars.find((candidate) => candidate.name === name);
  if (!envVar) {
    throw new Error(`Missing required env var fixture: ${name}`);
  }
  return envVar;
}

function runValidateEnvCli(env: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/validate-env.ts"],
    {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    }
  );
}

function buildCliEnv(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...VALID_REQUIRED_ENV,
    NODE_ENV: "production",
    SKIP_ENV_LOAD: "true",
    ...overrides,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    }
  }

  return env;
}

describe("environment variable validation", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    setNodeEnv("production");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("keeps test coverage aligned with every declared environment variable", () => {
    const allNames = [...requiredEnvVars, ...optionalEnvVars].map(
      (envVar) => envVar.name
    );

    expect(allNames).toEqual(EXPECTED_ENV_VAR_NAMES);
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  it("accepts valid production values for every required environment variable", () => {
    Object.assign(process.env, VALID_REQUIRED_ENV);

    for (const envVar of requiredEnvVars) {
      expect(validateEnvVar(envVar)).toEqual({ valid: true });
    }
  });

  it("rejects each production-required environment variable when missing", () => {
    for (const envVar of requiredEnvVars) {
      process.env = {
        ...originalEnv,
        ...VALID_REQUIRED_ENV,
        NODE_ENV: "production",
      };
      delete process.env[envVar.name];

      const result = validateEnvVar(envVar);

      expect(result.valid).toBe(false);
      expect(result.error).toContain(envVar.name);
      expect(result.error).toContain("not set");
    }
  });

  it.each([
    ["NEXT_PUBLIC_FIREBASE_API_KEY", "your-api-key", "actual Firebase API key"],
    [
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "your-project.firebaseapp.com",
      "actual Firebase project domain",
    ],
    [
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "your-project-id",
      "actual Firebase project ID",
    ],
    [
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "your-project.appspot.com",
      "actual Firebase storage bucket",
    ],
    [
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "your-sender-id",
      "actual Firebase sender ID",
    ],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", "your-app-id", "actual Firebase app ID"],
    [
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
      "https://your-project.firebaseio.com",
      "actual Firebase database URL",
    ],
  ])("rejects placeholder value for %s", (name, value, errorText) => {
    process.env[name] = value;

    const result = validateEnvVar(getRequiredEnvVar(name));

    expect(result.valid).toBe(false);
    expect(result.error).toContain(errorText);
  });

  it("allows optional environment variables to be absent", () => {
    for (const envVar of optionalEnvVars) {
      delete process.env[envVar.name];

      expect(validateEnvVar(envVar)).toEqual({ valid: true });
    }
  });

  it("allows a missing unsubscribe secret in development and test only", () => {
    const envVar = getRequiredEnvVar("UNSUBSCRIBE_SECRET");

    setNodeEnv("development");
    delete process.env.UNSUBSCRIBE_SECRET;
    expect(validateEnvVar(envVar)).toEqual({ valid: true });

    setNodeEnv("test");
    expect(validateEnvVar(envVar)).toEqual({ valid: true });

    setNodeEnv("production");
    const result = validateEnvVar(envVar);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not set");
  });

  it.each([
    ["short-secret", "32 bytes"],
    ["cursor-boston-unsub", "legacy public fallback"],
    ["your-unsubscribe-secret-value-that-is-long", "actual unsubscribe secret"],
  ])("rejects unsafe unsubscribe secret %s", (secret, errorText) => {
    process.env.UNSUBSCRIBE_SECRET = secret;

    const result = validateEnvVar(getRequiredEnvVar("UNSUBSCRIBE_SECRET"));

    expect(result.valid).toBe(false);
    expect(result.error).toContain(errorText);
  });

  it("exits with code 1 when a production-required variable is missing", () => {
    const result = runValidateEnvCli(
      buildCliEnv({ NEXT_PUBLIC_FIREBASE_API_KEY: undefined })
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(result.stdout).toContain("Found");
  });

  it("exits with code 0 when production-required variables are valid", () => {
    const result = runValidateEnvCli(buildCliEnv());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("All required environment variables are set");
  });
});
