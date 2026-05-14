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
    { name: "agents", description: "Programmatic agent registration, claiming, and self-service" },
    { name: "analytics", description: "Public aggregate analytics snapshots" },
    { name: "auth", description: "Authentication and email resolution" },
    { name: "badges", description: "Badge definitions and per-user awards" },
    { name: "certificate", description: "Verifiable merged-PR certificates" },
    { name: "cfp", description: "CFP graduate-student .edu email verification" },
    { name: "community", description: "Community posts, replies, reactions, moderation" },
    { name: "cookbook", description: "Prompt cookbook entries and votes" },
    { name: "discord", description: "Discord OAuth (link / unlink)" },
    { name: "events", description: "Coworking sessions and PyData 2026 ticketing" },
    { name: "game", description: "Strategy game endpoints (leaderboard, attacks, artifacts, turns)" },
    { name: "github", description: "GitHub OAuth + signed webhook receiver" },
    { name: "hackathons", description: "Hackathon pool, teams, submissions, and Hack-a-Sprint showcase" },
    { name: "health", description: "Liveness probe" },
    { name: "hiring-partners", description: "Hiring-partner application intake" },
    { name: "hunt", description: "Treasure hunt: oracle, paths, prize claim" },
    { name: "internal", description: "Cron-secret-protected maintenance endpoints" },
    { name: "live", description: "Live lightning-talks sessions, emcee control, and audience queue" },
    { name: "ludwitt", description: "Ludwitt OAuth + AI proxy through the shared credit pool" },
    { name: "maintainers", description: "Maintainer self-service and review queue" },
    { name: "members", description: "Public community members directory" },
    { name: "mentorship", description: "Mentor/mentee profiles, matches, requests" },
    { name: "notifications", description: "Email unsubscribe (HMAC token)" },
    { name: "notify-admin", description: "Email-relay endpoints for public submission forms" },
    { name: "pair", description: "Pair-programming profiles, matches, requests" },
    { name: "account", description: "Account lifecycle: GDPR delete, scheduled purge" },
    { name: "profile", description: "User profile: data, visibility, subscription, GitHub reconcile" },
    { name: "questions", description: "Q&A: questions, answers, votes, accept" },
    { name: "showcase", description: "Showcase project submissions, moderation, and votes" },
    { name: "summer-cohort", description: "Summer Cohort applications, intake survey, voting" },
    { name: "talks", description: "Talk-submission moderation queue" },
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

/**
 * Per-operation security: ts-rest's generator doesn't propagate `security`
 * from contract metadata into the spec. Heuristic: if an operation declares
 * a 401 response, it requires authentication — emit `security: [bearerAuth,
 * cookieAuth]` for it. Operations without 401 (public endpoints, cron
 * routes that 403, webhooks with custom auth) are left as unauthenticated.
 */
const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
] as const;

let authedOps = 0;
for (const pathItem of Object.values(openApiDoc.paths ?? {})) {
  if (!pathItem || typeof pathItem !== "object") continue;
  for (const method of HTTP_METHODS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = (pathItem as Record<string, any>)[method];
    if (!op || typeof op !== "object") continue;
    const responses = (op.responses ?? {}) as Record<string, unknown>;
    if ("401" in responses) {
      op.security = [{ bearerAuth: [] }, { cookieAuth: [] }];
      authedOps += 1;
    }
  }
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(openApiDoc, null, 2) + "\n", "utf8");

const operationCount = Object.values(openApiDoc.paths ?? {}).reduce(
  (sum, item) => sum + Object.keys(item ?? {}).length,
  0
);
console.log(
  `[openapi] Wrote ${OUTPUT_PATH} — ${
    Object.keys(openApiDoc.paths ?? {}).length
  } paths, ${operationCount} operations (${authedOps} require auth).`
);
