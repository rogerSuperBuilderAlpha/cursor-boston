import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const rootDir = path.resolve(__dirname, "..");

function getFiles(dir: string): string[] {
  const subdirs = fs.readdirSync(dir);
  const files = subdirs.map((subdir) => {
    const res = path.resolve(dir, subdir);
    return fs.statSync(res).isDirectory() ? getFiles(res) : res;
  });
  return files.flat().filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

const targetDirs = ["lib", "components", "app", "__tests__", "scripts", "fuzz", "config", "contexts", "hooks", "types"];
const files: string[] = [];
targetDirs.forEach((dir) => {
  const fullPath = path.join(rootDir, dir);
  if (fs.existsSync(fullPath)) {
    files.push(...getFiles(fullPath));
  }
});

let removedCount = 0;

files.forEach((filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const importedSymbols: { name: string; node: ts.Node }[] = [];
  const symbolUsages = new Map<string, number>();

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause) {
        if (clause.name) {
          importedSymbols.push({ name: clause.name.text, node: clause.name });
          symbolUsages.set(clause.name.text, 0);
        }
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            importedSymbols.push({
              name: clause.namedBindings.name.text,
              node: clause.namedBindings.name,
            });
            symbolUsages.set(clause.namedBindings.name.text, 0);
          } else if (ts.isNamedImports(clause.namedBindings)) {
            clause.namedBindings.elements.forEach((element) => {
              importedSymbols.push({ name: element.name.text, node: element.name });
              symbolUsages.set(element.name.text, 0);
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (importedSymbols.length === 0) return;

  function countUsage(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      let parent = node.parent;
      let isImportNode = false;
      while (parent) {
        if (ts.isImportDeclaration(parent)) {
          isImportNode = true;
          break;
        }
        parent = parent.parent;
      }

      if (!isImportNode && symbolUsages.has(name)) {
        symbolUsages.set(name, symbolUsages.get(name)! + 1);
      }
    }
    ts.forEachChild(node, countUsage);
  }
  countUsage(sourceFile);

  const unusedReact = importedSymbols.some(
    (sym) => sym.name === "React" && symbolUsages.get("React") === 0
  );

  if (unusedReact) {
    let newContent = content;
    // Replace: import React from "react";
    const importReactRegex1 = /import\s+React\s+from\s+['"]react['"];?\r?\n?/g;
    // Replace: import React, { ... } from "react";
    const importReactRegex2 = /import\s+React\s*,\s*\{\s*([\w\s,]+)\s*\}\s*from\s+['"]react['"];?/g;

    newContent = newContent.replace(importReactRegex1, "");
    newContent = newContent.replace(importReactRegex2, "import { $1 } from \"react\";");

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, "utf-8");
      const relPath = path.relative(rootDir, filePath);
      console.log(`Removed unused React import from ${relPath}`);
      removedCount++;
    }
  }
});

console.log(`\nRemoved unused React imports from ${removedCount} files.`);
