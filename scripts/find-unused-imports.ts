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

console.log(`Found ${files.length} TypeScript files.`);

let totalUnusedImports = 0;

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

  // First pass: identify imports
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

  // Second pass: count usages
  function countUsage(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      // Check if this identifier is part of the import declaration itself
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

  // Identify unused symbols
  const unusedInFile: string[] = [];
  importedSymbols.forEach((sym) => {
    if (symbolUsages.get(sym.name) === 0) {
      unusedInFile.push(sym.name);
    }
  });

  if (unusedInFile.length > 0) {
    const relPath = path.relative(rootDir, filePath);
    console.log(`[${relPath}] Unused imports: ${unusedInFile.join(", ")}`);
    totalUnusedImports += unusedInFile.length;
  }
});

console.log(`\nTotal unused imports found: ${totalUnusedImports}`);
