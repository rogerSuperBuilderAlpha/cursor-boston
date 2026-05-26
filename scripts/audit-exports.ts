import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const rootDir = path.resolve(__dirname, "..");

function getFilesRecursive(dir: string, excludeLib: boolean): string[] {
  const name = path.basename(dir);
  if (
    name === "node_modules" ||
    name === ".next" ||
    name === ".swc" ||
    name === ".git" ||
    (excludeLib && name === "lib")
  ) {
    return [];
  }
  if (!fs.existsSync(dir)) return [];
  const subdirs = fs.readdirSync(dir);
  const files = subdirs.map((subdir) => {
    const res = path.resolve(dir, subdir);
    if (fs.statSync(res).isDirectory()) {
      return getFilesRecursive(res, excludeLib);
    } else {
      return res;
    }
  });
  return files.flat().filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

const externalFiles = getFilesRecursive(rootDir, true);
const libFiles = getFilesRecursive(path.join(rootDir, "lib"), false);

console.log(`Auditing exports in ${libFiles.length} lib files...`);
console.log(`Checking usage in ${externalFiles.length} external files...`);

// Resolve import path to absolute file path
function resolveImportPath(importingFile: string, importSpecifier: string): string | null {
  let resolved: string;
  if (importSpecifier.startsWith("@/")) {
    resolved = path.join(rootDir, importSpecifier.slice(2));
  } else if (importSpecifier.startsWith(".") || importSpecifier.startsWith("..")) {
    resolved = path.resolve(path.dirname(importingFile), importSpecifier);
  } else {
    // Third-party package
    return null;
  }

  // Try common extensions
  const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx", ".d.ts"];
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }
  for (const ext of extensions) {
    const p = resolved + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }
  return null;
}

// Track usage of exports from lib files
const externalUsage = new Map<string, Set<string>>();
const externalFullImport = new Map<string, boolean>();

function recordUsage(
  usageMap: Map<string, Set<string>>,
  fullImportMap: Map<string, boolean>,
  resolvedPath: string,
  symbolName: string | null
) {
  if (!usageMap.has(resolvedPath)) {
    usageMap.set(resolvedPath, new Set());
  }
  if (symbolName) {
    usageMap.get(resolvedPath)!.add(symbolName);
  } else {
    fullImportMap.set(resolvedPath, true);
  }
}

// Analyze imports in a file
function analyzeFileImports(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const importSpec = specifier.text;
        const resolved = resolveImportPath(filePath, importSpec);
        if (resolved && resolved.startsWith(path.join(rootDir, "lib"))) {
          const clause = node.importClause;
          if (clause) {
            if (clause.name) {
              recordUsage(externalUsage, externalFullImport, resolved, "default");
            }
            if (clause.namedBindings) {
              if (ts.isNamespaceImport(clause.namedBindings)) {
                recordUsage(externalUsage, externalFullImport, resolved, null);
              } else if (ts.isNamedImports(clause.namedBindings)) {
                clause.namedBindings.elements.forEach((el) => {
                  const importedName = el.propertyName ? el.propertyName.text : el.name.text;
                  recordUsage(externalUsage, externalFullImport, resolved, importedName);
                });
              }
            }
          } else {
            recordUsage(externalUsage, externalFullImport, resolved, null);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

// Populate import usage from all external files
externalFiles.forEach((file) => analyzeFileImports(file));

// Now audit each lib file's exports
let markedInternalCount = 0;

libFiles.forEach((filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const extUsedSymbols = externalUsage.get(filePath) || new Set<string>();
  const extFull = externalFullImport.get(filePath) || false;

  const modifications: { start: number; end: number; replacement: string }[] = [];

  function processDeclaration(node: ts.Node, name: string, isDefault = false) {
    const symbolKey = isDefault ? "default" : name;
    const isUsedExternally = extFull || extUsedSymbols.has(symbolKey);

    if (isUsedExternally) {
      return;
    }

    const hasExportModifier = (node as any).modifiers && (node as any).modifiers.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!hasExportModifier && !isDefault) {
      return;
    }

    const commentRange = ts.getLeadingCommentRanges(content, node.pos);
    const hasInternalComment = commentRange && commentRange.some((r) => {
      const commentText = content.substring(r.pos, r.end);
      return commentText.includes("@internal");
    });

    if (!hasInternalComment) {
      modifications.push({
        start: node.getStart(),
        end: node.getStart(),
        replacement: "/** @internal */\n",
      });
      markedInternalCount++;
      console.log(`[INTERNAL] Mark ${name} in ${path.relative(rootDir, filePath)}`);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      processDeclaration(node, node.name.text);
    } else if (ts.isClassDeclaration(node) && node.name) {
      processDeclaration(node, node.name.text);
    } else if (ts.isInterfaceDeclaration(node)) {
      processDeclaration(node, node.name.text);
    } else if (ts.isTypeAliasDeclaration(node)) {
      processDeclaration(node, node.name.text);
    } else if (ts.isVariableStatement(node)) {
      const isExported = (node as any).modifiers && (node as any).modifiers.some((m: any) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            processDeclaration(node, decl.name.text);
          }
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (modifications.length > 0) {
    modifications.sort((a, b) => b.start - a.start);
    let newContent = content;
    modifications.forEach((mod) => {
      newContent = newContent.slice(0, mod.start) + mod.replacement + newContent.slice(mod.end);
    });
    fs.writeFileSync(filePath, newContent, "utf-8");
  }
});

console.log(`\nAudit completed:`);
console.log(`- Marked as /** @internal */: ${markedInternalCount} exports`);
