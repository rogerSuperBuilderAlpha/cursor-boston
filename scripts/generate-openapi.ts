/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Generates `public/openapi.json` from the ts-rest contracts under
 * `lib/api-schemas/`. Mirrors the pattern of `generate-llms-txt.js`:
 * runs in `prebuild`, regenerates on every deploy.
 *
 * The generated file is NOT checked into git — it's a build artifact.
 * Swagger UI at `/api/docs` reads it at runtime.
 */

import { generateOpenApi } from "@ts-rest/open-api";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { apiContract, SECURITY_SCHEMES } from "../lib/api-schemas";

const OUTPUT_PATH = join(__dirname, "..", "public", "openapi.json");

const baseDocument = {
  openapi: "3.0.3",
  info: {
    title: "Cursor Boston API",
    version: "0.1.0",
    description:
      "REST API for the Cursor Boston community platform. See https://github.com/rogerSuperBuilderAlpha/cursor-boston for source. Authentication uses Firebase Auth ID tokens (Bearer) or session cookies.",
    license: { name: "GPL-3.0", url: "https://www.gnu.org/licenses/gpl-3.0.html" },
    contact: {
      name: "Cursor Boston",
      url: "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
    },
  },
  servers: [
    { url: "https://cursorboston.com", description: "Production" },
    { url: "http://localhost:3000", description: "Local dev" },
  ],
  tags: [
    { name: "auth", description: "Authentication and email resolution" },
    { name: "community", description: "Community posts, replies, reactions, moderation" },
    { name: "game", description: "Strategy game endpoints (leaderboard, attacks, artifacts, turns)" },
    { name: "hackathons", description: "Hackathon pool, teams, submissions, and Hack-a-Sprint showcase" },
    { name: "questions", description: "Q&A: questions, answers, votes, accept" },
    { name: "account", description: "Account lifecycle: GDPR delete, scheduled purge" },
    { name: "profile", description: "User profile: data, visibility, subscription, GitHub reconcile" },
  ],
};

const openApiDoc = generateOpenApi(apiContract, baseDocument, {
  setOperationId: "concatenated-path",
  jsonQuery: false,
});

// Inject security schemes (zod-to-openapi/ts-rest doesn't carry these
// through the contract, so we attach them once on the final document).
openApiDoc.components = {
  ...openApiDoc.components,
  securitySchemes: SECURITY_SCHEMES,
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(openApiDoc, null, 2) + "\n", "utf8");

const operationCount = Object.values(openApiDoc.paths ?? {}).reduce(
  (sum, item) => sum + Object.keys(item ?? {}).length,
  0
);
console.log(
  `[openapi] Wrote ${OUTPUT_PATH} — ${
    Object.keys(openApiDoc.paths ?? {}).length
  } paths, ${operationCount} operations.`
);
