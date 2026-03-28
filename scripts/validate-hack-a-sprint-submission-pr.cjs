#!/usr/bin/env node
/**
 * CI: validate Hack-a-Sprint 2026 submission PRs.
 * Env: GITHUB_ACTOR, AUTHOR_ASSOCIATION (optional)
 * Prefer GIT_DIFF_RANGE="base...head" (PR base sha ... head sha) from Actions.
 */
const { readFileSync } = require("fs");
const { resolve, basename } = require("path");
const { execSync } = require("child_process");

const ROOT = resolve(__dirname, "..");
const PREFIX = "content/hackathons/hack-a-sprint-2026/submissions/";
const SCHEMA_PATH = resolve(
  ROOT,
  "content/hackathons/hack-a-sprint-2026/submission.schema.json"
);

const actor = (process.env.GITHUB_ACTOR || "").trim();
const assoc = process.env.AUTHOR_ASSOCIATION || "NONE";
const maintainer = ["OWNER", "MEMBER", "COLLABORATOR"].includes(assoc);
const diffRange =
  process.env.GIT_DIFF_RANGE ||
  `${process.env.GITHUB_BASE_REF || "main"}...${process.env.GITHUB_SHA || "HEAD"}`;

function getChangedFiles() {
  let out;
  try {
    out = execSync(`git diff --name-only ${diffRange}`, {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch (e) {
    console.error("git diff failed:", e.message);
    process.exit(1);
  }
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const submissionJsonRe =
  /^content\/hackathons\/hack-a-sprint-2026\/submissions\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*)\.json$/;

function validateJsonAgainstSchema(obj) {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const required = schema.required || [];
  for (const key of required) {
    if (obj[key] === undefined || obj[key] === null) {
      throw new Error(`Missing required field: ${key}`);
    }
  }
  const allowed = new Set([
    ...required,
    ...Object.keys(schema.properties || {}),
  ]);
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new Error(`Unknown field: ${k}`);
    }
  }
  for (const [key, spec] of Object.entries(schema.properties || {})) {
    if (obj[key] === undefined) continue;
    const t = spec.type;
    if (t && typeof obj[key] !== t) {
      throw new Error(`Field ${key} must be ${t}`);
    }
    if (t === "string" && spec.minLength && obj[key].length < spec.minLength) {
      throw new Error(`Field ${key} too short`);
    }
    if (t === "string" && spec.maxLength && obj[key].length > spec.maxLength) {
      throw new Error(`Field ${key} too long`);
    }
    if (spec.format === "uri" && typeof obj[key] === "string") {
      try {
        const u = new URL(obj[key]);
        if (!u.protocol.startsWith("http")) throw new Error("not http(s)");
      } catch {
        throw new Error(`Field ${key} must be a valid URL`);
      }
    }
  }
}

const allChanged = getChangedFiles();
const underPrefix = allChanged.filter((f) => f.startsWith(PREFIX));
const jsonUnder = underPrefix.filter((f) => f.endsWith(".json"));
const otherUnder = underPrefix.filter((f) => !f.endsWith(".json"));
const outside = allChanged.filter((f) => !f.startsWith(PREFIX));

if (outside.length > 0 && !maintainer) {
  console.error(
    "PR touches files outside submissions folder (non-maintainers may only change submissions/*.json):",
    outside.join(", ")
  );
  process.exit(1);
}

if (otherUnder.length > 0 && !maintainer) {
  console.error(
    "Non-JSON files under submissions/ are not allowed for external contributors:",
    otherUnder.join(", ")
  );
  process.exit(1);
}

if (jsonUnder.length === 0) {
  console.log("No submission JSON in this PR; skipping submission validation.");
  process.exit(0);
}

if (!maintainer && jsonUnder.length !== 1) {
  console.error(
    "External contributors must change exactly one submission JSON file; got:",
    jsonUnder.length
  );
  process.exit(1);
}

for (const file of jsonUnder) {
  const m = file.match(submissionJsonRe);
  if (!m) {
    console.error("Invalid submission path or filename:", file);
    process.exit(1);
  }
  const loginFromFile = m[1];
  if (!maintainer && loginFromFile.toLowerCase() !== actor.toLowerCase()) {
    console.error(
      `Filename must match your GitHub login: expected ${actor}.json, got ${basename(file)}`
    );
    process.exit(1);
  }
  const full = resolve(ROOT, file);
  let data;
  try {
    data = JSON.parse(readFileSync(full, "utf8"));
  } catch (e) {
    console.error("Invalid JSON:", file, e.message);
    process.exit(1);
  }
  try {
    validateJsonAgainstSchema(data);
  } catch (e) {
    console.error("Schema validation failed:", file, e.message);
    process.exit(1);
  }
}

console.log("Hack-a-Sprint submission validation OK.");
