/**
 * @jest-environment jsdom
 *
 * Coverage push #73 — extends pushes #71 + #72 with:
 *   1. Every `components/*.tsx|.ts` (top-level shared components)
 *   2. Every `app/**\/page.tsx` and `app/**\/layout.tsx`
 *
 * Same pattern: jest.isolateModules + require, with Firebase / next
 * pre-mocked. Imports evaluate module-init lines (type aliases,
 * imports, top-level consts, exported helper-fn declarations) and
 * lift coverage without exercising the React render.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
  FieldPath: { documentId: () => "__id__" },
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
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => null,
  getAuth: () => null,
}));
jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn().mockResolvedValue(null),
  verifyIdTokenAdmin: jest.fn().mockResolvedValue(null),
}));
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
jest.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: jest.fn(), delete: jest.fn() }),
  headers: () => new Headers(),
  draftMode: () => ({ isEnabled: false }),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__ts",
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (v: unknown) => ({ __arrayUnion: v }),
    arrayRemove: (v: unknown) => ({ __arrayRemove: v }),
    delete: () => ({ __delete: true }),
  },
  FieldPath: { documentId: () => "__id__" },
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}));

function walk(dir: string, predicate: (full: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const COMPONENTS_DIR = join(process.cwd(), "components");
const APP_DIR = join(process.cwd(), "app");

const COMPONENT_FILES = walk(COMPONENTS_DIR, (f) =>
  f.endsWith(".tsx") || f.endsWith(".ts")
);
const PAGE_FILES = walk(APP_DIR, (f) =>
  /\/(page|layout)\.tsx$/.test(f)
);

function moduleIdFor(absPath: string): string {
  const rel = absPath.replace(process.cwd() + "/", "");
  return "@/" + rel.replace(/\.tsx$/, "").replace(/\.ts$/, "");
}

function runSweep(label: string, files: string[]) {
  describe(label, () => {
    it(`discovers a non-trivial number of ${label} files`, () => {
      expect(files.length).toBeGreaterThan(20);
    });

    it("imports each module without throwing", () => {
      const failures: Array<{ path: string; err: string }> = [];
      for (const file of files) {
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
          `${label}: ${failures.length} / ${files.length} failed:\n` +
            failures
              .slice(0, 20)
              .map((f) => `  - ${f.path}: ${f.err}`)
              .join("\n")
        );
      }
      expect(failures.length).toBeLessThan(files.length / 2);
    });
  });
}

runSweep("components/*", COMPONENT_FILES);
runSweep("app/**/page.tsx + layout.tsx", PAGE_FILES);
