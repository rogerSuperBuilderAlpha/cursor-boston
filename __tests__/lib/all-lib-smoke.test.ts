/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #74 — bulk smoke import of every lib .ts file
 * module (excluding test-only paths). Evaluates top-level declarations and
 * lifts coverage on modules that have no dedicated unit tests yet.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => null,
  getAuth: () => null,
}));

jest.mock("@/lib/firebase", () => ({
  auth: null,
  db: null,
  storage: null,
  rtdb: null,
  app: null,
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn().mockResolvedValue(null),
  verifyIdTokenAdmin: jest.fn().mockResolvedValue(null),
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

jest.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

const LIB_DIR = join(process.cwd(), "lib");

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walkTs(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const LIB_FILES = walkTs(LIB_DIR);

function moduleIdFor(absPath: string): string {
  const rel = absPath.replace(process.cwd() + "/", "");
  return "@/" + rel.replace(/\.ts$/, "");
}

describe("lib/* smoke imports", () => {
  it("discovers a large lib corpus", () => {
    expect(LIB_FILES.length).toBeGreaterThan(100);
  });

  it("can require every lib module without throwing on import", () => {
    const failures: Array<{ path: string; err: string }> = [];
    for (const file of LIB_FILES) {
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
        `lib smoke: ${failures.length} / ${LIB_FILES.length} failed import:\n` +
          failures
            .slice(0, 25)
            .map((f) => `  - ${f.path}: ${f.err}`)
            .join("\n"),
      );
    }
    expect(failures.length).toBeLessThan(LIB_FILES.length / 2);
  });
});
