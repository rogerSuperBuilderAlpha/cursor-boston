#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIRS = ["app", "lib", "components", "hooks", "contexts", "types"];

const HEADER = `/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */
`;

function hasHeader(content) {
  return content.includes("licensed under GPL-3.0");
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  if (hasHeader(content)) {
    return;
  }

  const updated = HEADER + "\n" + content;
  fs.writeFileSync(filePath, updated, "utf8");

  console.log(`✔ Added header: ${filePath}`);
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (
      entry.isFile() &&
      (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))
    ) {
      processFile(fullPath);
    }
  }
}

function main() {
  ROOT_DIRS.forEach((dir) => walkDir(path.resolve(process.cwd(), dir)));
}

main();