/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Generates public/llms.txt from docs/API.md and the app directory structure.
 * Run via: node scripts/generate-llms-txt.js
 * Wired into prebuild so it regenerates on every deploy.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API_MD = path.join(ROOT, "docs", "API.md");
const OUTPUT = path.join(ROOT, "public", "llms.txt");
const APP_DIR = path.join(ROOT, "app");

/** Discover page routes from app/ directory. */
function discoverPages() {
  const pages = [];
  function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name === "api" || entry.name === "llms.txt") continue;
      if (entry.isDirectory()) {
        // Strip route groups like (auth)
        const segment = entry.name.startsWith("(") ? "" : entry.name;
        walk(path.join(dir, entry.name), prefix + (segment ? "/" + segment : ""));
      }
      if (entry.name === "page.tsx" && prefix) {
        pages.push(prefix);
      }
    }
  }
  walk(APP_DIR, "");
  return pages.sort();
}

/** Parse API.md markdown tables into endpoint lines. */
function parseApiEndpoints() {
  const content = fs.readFileSync(API_MD, "utf-8");
  const lines = content.split("\n");
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    // Section headers
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h2) {
      // Skip non-endpoint sections at the bottom
      if (["Authentication", "Rate Limiting"].includes(h2[1])) break;
      currentSection = { name: h2[1], endpoints: [] };
      sections.push(currentSection);
      continue;
    }
    if (h3 && currentSection) {
      currentSection = { name: h3[1], endpoints: [] };
      sections.push(currentSection);
      continue;
    }

    // Table rows: | METHOD | `/api/...` | Auth | Description |
    const row = line.match(/^\|\s*(GET|POST|PATCH|PUT|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|/);
    if (row && currentSection) {
      currentSection.endpoints.push({
        method: row[1],
        path: row[2],
        auth: row[3],
        description: row[4],
      });
    }
  }

  return sections;
}

/** Format endpoint sections as plain text. */
function formatEndpoints(sections) {
  const lines = [];
  for (const section of sections) {
    if (section.endpoints.length === 0) continue;
    lines.push(`### ${section.name}`);
    lines.push("");
    for (const ep of section.endpoints) {
      const method = ep.method.padEnd(6);
      const auth = ep.auth === "No" ? "" : ` [${ep.auth}]`;
      lines.push(`    ${method} ${ep.path}${auth} — ${ep.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// --- Build the file ---

const pages = discoverPages();
const sections = parseApiEndpoints();
const endpointCount = sections.reduce((n, s) => n + s.endpoints.length, 0);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));

const output = `# Cursor Boston

> The hub for Boston's AI-powered development community.
> https://cursorboston.com

## About

Cursor Boston is a community platform for AI-native developers in the
Boston area. Members attend events, participate in hackathons, pair
program, share projects in a showcase, contribute to open source, and
earn badges for participation.

Built with Next.js ${pkg.dependencies.next.replace("^", "").split(".")[0]}, React ${pkg.dependencies.react.replace("^", "").split(".")[0]}, TypeScript, Tailwind CSS, Firebase.
Licensed ${pkg.license}.

## Pages

${pages.map((p) => `    ${p}`).join("\n")}

## Authentication

Firebase Auth. Include the ID token:

    Authorization: Bearer <firebase-id-token>

Auth levels: No (public), Yes (authenticated user), Admin, Cron (CRON_SECRET header).

AI agents authenticate with:

    Authorization: Bearer cb_agent_<key>

Register at POST /api/agents/register to get a key.

## API (${endpointCount} endpoints)

${formatEndpoints(sections)}
## Error Format

    {"error": "Description of what went wrong"}

Status codes: 400 (validation), 401 (unauthorized), 403 (forbidden),
404 (not found), 429 (rate limited), 500 (server error).

## Rate Limits

Per-endpoint. Headers on every response:
X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
Defaults: 60 req/min general, 10 req/15min OAuth, 30 req/min hackathon reads.

## Contributing

GitHub: https://github.com/rogerSuperBuilderAlpha/cursor-boston
Fork the repo, branch from develop, PRs against develop.
DCO sign-off required: git commit -s

Docs: docs/FIRST_CONTRIBUTION.md, docs/DEVELOPMENT.md, docs/API.md
Discord: https://discord.gg/Wsncg8YYqc
Events: https://lu.ma/cursor-boston
`;

fs.writeFileSync(OUTPUT, output);
console.log(`Generated ${OUTPUT} (${endpointCount} endpoints, ${pages.length} pages)`);
