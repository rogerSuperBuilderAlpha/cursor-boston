#!/usr/bin/env node

/**
 * One-shot backfill: insert `SPDX-License-Identifier: GPL-3.0-only` into
 * existing GPL headers that pre-date the SPDX update in
 * `scripts/add-gpl-headers.js`. Idempotent — skips files that already have
 * the SPDX line.
 *
 * Run via: `node scripts/backfill-spdx-headers.js`
 *
 * Rationale: OpenSSF Best Practices Gold requires every source file to
 * carry a machine-readable license identifier (criterion `license_per_file`).
 * 815+ files were generated before `add-gpl-headers.js` was updated to emit
 * SPDX, so they need a one-time rewrite. Once this runs and lands, the
 * primary generator continues to emit headers with SPDX baked in for any
 * new file.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIRS = ["app", "lib", "components", "hooks", "contexts", "types"];

const SPDX_LINE = " * SPDX-License-Identifier: GPL-3.0-only";
const HEADER_OPEN = "/**";
const LICENSE_MARKER = "licensed under GPL-3.0";

function hasSpdx(content) {
  return content.includes("SPDX-License-Identifier");
}

function hasLegacyHeader(content) {
  return content.includes(LICENSE_MARKER);
}

function backfillFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  if (hasSpdx(content)) return "skipped:has-spdx";
  if (!hasLegacyHeader(content)) return "skipped:no-header";

  const lines = content.split("\n");
  const openIdx = lines.findIndex((l) => l.trim() === HEADER_OPEN);
  if (openIdx === -1) return "skipped:no-open";

  lines.splice(openIdx + 1, 0, SPDX_LINE);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return "updated";
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (
      entry.isFile() &&
      (p.endsWith(".ts") || p.endsWith(".tsx"))
    ) {
      out.push(p);
    }
  }
}

function main() {
  const files = [];
  ROOT_DIRS.forEach((d) => walk(path.resolve(process.cwd(), d), files));

  const counts = { updated: 0, "skipped:has-spdx": 0, "skipped:no-header": 0, "skipped:no-open": 0 };
  for (const f of files) {
    const result = backfillFile(f);
    counts[result] = (counts[result] || 0) + 1;
  }

  console.log(`Scanned ${files.length} files in ${ROOT_DIRS.join(", ")}:`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
}

main();
