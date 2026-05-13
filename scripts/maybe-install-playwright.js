#!/usr/bin/env node
/*
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Runs after `npm install`. Installs the Playwright Chromium binary for local
// developers so `npm run test:e2e` works without a manual `playwright install`
// step. Skipped in CI (the e2e workflow caches the browser separately) and
// when the contributor opts out with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1.
//
// Failures here are non-fatal — Playwright is only required for e2e tests, so
// a missing browser must never block a regular `npm install`.

"use strict";

const SKIP_ENV_KEYS = [
  "CI",
  "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD",
  "PLAYWRIGHT_SKIP_BROWSER_GC",
];

function shouldSkip() {
  for (const key of SKIP_ENV_KEYS) {
    const value = process.env[key];
    if (value && value !== "0" && value.toLowerCase() !== "false") {
      return key;
    }
  }
  return null;
}

const skipReason = shouldSkip();
if (skipReason) {
  console.log(
    `[postinstall] Skipping Playwright Chromium install (${skipReason} is set).`
  );
  process.exit(0);
}

const { spawnSync } = require("node:child_process");
const result = spawnSync("npx", ["playwright", "install", "chromium"], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
});

if (result.error || (typeof result.status === "number" && result.status !== 0)) {
  console.log(
    "[postinstall] Playwright Chromium install did not complete cleanly. " +
      "This is non-fatal; run `npm run test:e2e:install` before running e2e tests."
  );
}
