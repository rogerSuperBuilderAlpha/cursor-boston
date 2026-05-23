/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

jest.mock("@next/bundle-analyzer", () => () => (config: unknown) => config);
jest.mock("child_process", () => ({
  execSync: jest.fn(() => "test-build-id\n"),
}));

const ORIGINAL_ENV = process.env;
const TOGGLED_ENV_KEYS = [
  "ANALYZE",
  "CI",
  "DOCKER_BUILD",
  "GITHUB_ACTIONS",
  "NEXT_BUILD_ID",
  "SKIP_TYPECHECK",
] as const;

function loadNextConfig(env: Record<string, string | undefined> = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  for (const key of TOGGLED_ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  let config: {
    typescript?: { ignoreBuildErrors?: boolean };
    eslint?: { ignoreDuringBuilds?: boolean };
  };
  jest.isolateModules(() => {
    config = require("../../next.config.js");
  });
  return config!;
}

describe("next.config.js SKIP_TYPECHECK guard", () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  it("leaves build checks enabled by default", () => {
    const config = loadNextConfig();

    expect(config.typescript?.ignoreBuildErrors).not.toBe(true);
    expect(config.eslint?.ignoreDuringBuilds).not.toBe(true);
  });

  it("allows SKIP_TYPECHECK only for local builds", () => {
    const config = loadNextConfig({ SKIP_TYPECHECK: "1" });

    expect(config.typescript).toEqual({ ignoreBuildErrors: true });
    expect(config.eslint).toEqual({ ignoreDuringBuilds: true });
  });

  it("rejects SKIP_TYPECHECK in generic CI", () => {
    expect(() =>
      loadNextConfig({ CI: "true", SKIP_TYPECHECK: "1" })
    ).toThrow("SKIP_TYPECHECK=1 is local-only and must not be set in CI");
  });

  it("rejects SKIP_TYPECHECK in GitHub Actions", () => {
    expect(() =>
      loadNextConfig({ GITHUB_ACTIONS: "true", SKIP_TYPECHECK: "1" })
    ).toThrow("SKIP_TYPECHECK=1 is local-only and must not be set in CI");
  });
});
