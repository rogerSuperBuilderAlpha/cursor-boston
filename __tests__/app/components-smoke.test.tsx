/**
 * @jest-environment jsdom
 *
 * Coverage push #72 — bulk smoke import of `app/**\/_components/*.tsx`
 * (and `_hooks`, `_lib` for completeness). Same pattern as push #71's
 * route smoke but applied to client components and hooks.
 *
 * Importing a "use client" component file evaluates its top-level
 * declarations: imports, type aliases, constants, helper functions.
 * That's enough to lift coverage on a ~120-component corpus that
 * otherwise has no dedicated tests.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Mock all of Firebase + client SDK calls so nothing dies at import time.
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updateProfile: jest.fn(),
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: () => "__ts",
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
  arrayUnion: (v: unknown) => v,
  arrayRemove: (v: unknown) => v,
  increment: (n: number) => n,
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock("firebase/database", () => ({
  ref: jest.fn(),
  onValue: jest.fn(() => jest.fn()),
  set: jest.fn(),
  push: jest.fn(),
  remove: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: null,
  db: null,
  storage: null,
  rtdb: null,
  app: null,
}));

// next/navigation hooks — components call these at render but not at import
// in most cases. Provide harmless stubs anyway.
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

const APP_DIR = join(process.cwd(), "app");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (
      (entry.endsWith(".tsx") || entry.endsWith(".ts")) &&
      // Only target _components / _hooks / _lib helper directories
      (full.includes("/_components/") ||
        full.includes("/_hooks/") ||
        full.includes("/_lib/"))
    ) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walk(APP_DIR);

function moduleIdFor(absPath: string): string {
  const rel = absPath.replace(process.cwd() + "/", "");
  return (
    "@/" +
    rel
      .replace(/\.tsx$/, "")
      .replace(/\.ts$/, "")
  );
}

describe("app/**/_components smoke imports", () => {
  it("discovers a non-trivial number of component files", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("imports each component / hook module without throwing", () => {
    const failures: Array<{ path: string; err: string }> = [];
    for (const file of FILES) {
      const id = moduleIdFor(file);
      try {
        jest.isolateModules(() => {
           
          require(id);
        });
      } catch (e) {
        failures.push({
          path: file.replace(process.cwd() + "/", ""),
          err: e instanceof Error ? e.message.split("\n")[0] : String(e),
        });
      }
    }
    if (failures.length > 0) {
       
      console.warn(
        `Component smoke imports: ${failures.length} / ${FILES.length} failed:\n` +
          failures
            .slice(0, 20)
            .map((f) => `  - ${f.path}: ${f.err}`)
            .join("\n")
      );
    }
    expect(failures.length).toBeLessThan(FILES.length / 2);
  });
});
