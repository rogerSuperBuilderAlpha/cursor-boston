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

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { isAppRoute, type AppRoute, type AppRouter } from "@ts-rest/core";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { apiContract, SECURITY_SCHEMES } from "../lib/api-schemas";

const OUTPUT_PATH = join(__dirname, "..", "public", "openapi.json");

const baseDocument = {
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

/**
 * Walk the ts-rest router and register every route with zod-to-openapi.
 *
 * @ts-rest/open-api converted schemas through @anatine/zod-openapi, which
 * only understands zod 3 and emits `{}` for zod 4 schemas. zod-to-openapi
 * supports zod 4 and honours the `.openapi()` metadata on our schemas, so
 * we build the paths here and let it convert the schemas. Path, tag and
 * operationId conventions match the old `setOperationId: "concatenated-path"`
 * output.
 */
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType;
}

function pathParamsFor(openApiPath: string, schema: unknown): z.ZodObject | undefined {
  const declared = schema instanceof z.ZodObject ? schema : undefined;
  const names = (openApiPath.match(/{[^}]+}/g) ?? []).map((p) => p.slice(1, -1));
  const missing = names.filter((name) => !declared || !(name in declared.shape));
  if (!declared && missing.length === 0) return undefined;
  const extra = Object.fromEntries(missing.map((name) => [name, z.string()]));
  return declared ? declared.extend(extra) : z.object(extra);
}

function registerRoute(
  registry: OpenAPIRegistry,
  route: AppRoute,
  id: string,
  history: string[]
): void {
  const path = route.path.replace(/:(\w+)/g, "{$1}");
  const request: NonNullable<RouteConfig["request"]> = {};

  const params = pathParamsFor(path, route.pathParams);
  if (params) request.params = params;
  if (route.query instanceof z.ZodObject) request.query = route.query;
  if (route.headers instanceof z.ZodObject) request.headers = route.headers;
  if (MUTATION_METHODS.has(route.method) && "body" in route && isZodSchema(route.body)) {
    const contentType =
      "contentType" in route && route.contentType ? route.contentType : "application/json";
    request.body = {
      description: "Body",
      content: { [contentType]: { schema: route.body } },
    };
  }

  const responses: RouteConfig["responses"] = {};
  for (const [status, response] of Object.entries(route.responses)) {
    responses[status] = isZodSchema(response)
      ? {
          description: response.description ?? status,
          content: { "application/json": { schema: response } },
        }
      : { description: status };
  }

  registry.registerPath({
    method: route.method.toLowerCase() as RouteConfig["method"],
    path,
    tags: history,
    operationId: [...history, id].join("."),
    summary: route.summary,
    description: route.description,
    deprecated: route.deprecated,
    request,
    responses,
  });
}

function registerRouter(registry: OpenAPIRegistry, router: AppRouter, history: string[]): void {
  for (const [key, value] of Object.entries(router)) {
    if (isAppRoute(value)) {
      registerRoute(registry, value, key, history);
    } else {
      registerRouter(registry, value, [...history, key]);
    }
  }
}

const registry = new OpenAPIRegistry();
registerRouter(registry, apiContract, []);

const openApiDoc = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: "3.0.3",
  ...baseDocument,
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
