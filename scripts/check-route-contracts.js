/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Fails the build if any route handler under app/api/ doesn't import from
 * `@/lib/api-schemas/` AND isn't listed in `contract-exemptions.json`.
 *
 * The exemption list is the migration debt counter for issue #234. Each
 * migration PR must remove its routes from the JSON. When the list is
 * empty, every route has a ts-rest contract and full OpenAPI coverage is
 * achieved — at that point this script can be tightened to flat-fail any
 * route without a schema import.
 *
 * Run: node scripts/check-route-contracts.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const API_DIR = path.join(ROOT, "app", "api");
const EXEMPTIONS_PATH = path.join(__dirname, "contract-exemptions.json");
const SCHEMA_IMPORT_RE = /from\s+["']@\/lib\/api-schemas/;
// Marker comment for routes that have a contract entry but no runtime
// inputs to validate (pure GETs with no body / query / path params).
// Accept this as proof the route is contract-backed without forcing a
// ceremonial unused import.
const CONTRACT_MARKER_RE = /\/\/\s*@contracts:\s*[A-Za-z]/;

// /api/docs serves Swagger UI HTML — no contract by design.
const ALWAYS_EXEMPT = new Set(["docs"]);

const exemptionsFile = JSON.parse(fs.readFileSync(EXEMPTIONS_PATH, "utf8"));
const EXEMPT_ROUTES = new Set([
  ...ALWAYS_EXEMPT,
  ...exemptionsFile.routes,
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      yield full;
    }
  }
}

const violators = [];
const orphanedExemptions = new Set(exemptionsFile.routes);
let withContract = 0;

for (const file of walk(API_DIR)) {
  const rel = path
    .relative(API_DIR, file)
    .replace(/[\\/]route\.tsx?$/, "");
  const src = fs.readFileSync(file, "utf8");
  const hasContract =
    SCHEMA_IMPORT_RE.test(src) || CONTRACT_MARKER_RE.test(src);
  if (hasContract) {
    withContract += 1;
    orphanedExemptions.delete(rel);
    if (exemptionsFile.routes.includes(rel)) {
      // Migrated but not removed from exemption list — flag as a soft warning.
      console.warn(
        `[contracts] ${rel} now has a contract — please remove it from scripts/contract-exemptions.json`
      );
    }
    continue;
  }
  orphanedExemptions.delete(rel);
  if (EXEMPT_ROUTES.has(rel)) continue;
  violators.push(rel);
}

// Routes listed as exempt that no longer exist (deleted/renamed).
const orphans = [...orphanedExemptions];

if (violators.length === 0 && orphans.length === 0) {
  const remaining = exemptionsFile.routes.length;
  console.log(
    `[contracts] OK. ${withContract} route(s) have contracts; ${remaining} still on the migration debt list.`
  );
  process.exit(0);
}

if (violators.length > 0) {
  console.error(
    "\n[contracts] The following NEW routes do not import a ts-rest contract from `@/lib/api-schemas/`:"
  );
  for (const v of violators) {
    console.error(`  - app/api/${v}/route.ts`);
  }
  console.error(
    "\nEvery new route must validate input via a contract schema (see app/api/game/leaderboard/route.ts for the pattern)."
  );
}

if (orphans.length > 0) {
  console.error(
    "\n[contracts] The following routes are listed in contract-exemptions.json but no longer exist:"
  );
  for (const o of orphans) {
    console.error(`  - ${o}`);
  }
  console.error(
    "\nRemove them from scripts/contract-exemptions.json."
  );
}

process.exit(1);
