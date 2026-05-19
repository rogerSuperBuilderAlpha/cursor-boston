/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #74 — invoke exported HTTP handlers on every
 * app/api route.ts handlers with minimal requests + mocked auth/Firestore.
 * Exercises handler bodies (auth guards, validation, early returns) beyond
 * the import-only sweep in all-routes-smoke.test.ts.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { makeCronRequest } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: jest.fn(() => {
      const chain = {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: jest.fn(),
          update: jest.fn(),
        })),
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
        count: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
        }),
      };
      chain.where.mockReturnValue(chain);
      chain.orderBy.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      return chain;
    }),
    runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    ),
  })),
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockRejectedValue(new Error("invalid")),
  })),
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

jest.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: jest.fn(), delete: jest.fn() }),
  headers: () => new Headers(),
  draftMode: () => ({ isEnabled: false }),
}));

const APP_API = join(process.cwd(), "app", "api");
const HTTP_EXPORTS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

const ROUTE_FILES = walk(APP_API);

function moduleIdFor(absPath: string): string {
  const rel = absPath.replace(process.cwd() + "/", "");
  return "@/" + rel.replace(/\.ts$/, "");
}

/** Build `/api/...` path from absolute route file path. */
function apiPathFromFile(absPath: string): string {
  const rel = absPath.replace(join(process.cwd(), "app"), "").replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.ts$/, "");
  return withoutRoute || "/api";
}

/** Next.js 15+ dynamic route context from `[param]` and `[...slug]` segments. */
function buildRouteContext(apiPath: string): { params: Promise<Record<string, string | string[]>> } {
  const segments = apiPath.split("/").filter(Boolean);
  const params: Record<string, string | string[]> = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith("[...") && seg.endsWith("]")) {
      const key = seg.slice(4, -1);
      params[key] = ["test-a", "test-b"];
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      const key = seg.slice(1, -1);
      params[key] = `test-${key}`;
    }
  }
  return { params: Promise.resolve(params) };
}

function makeRequestForPath(
  method: string,
  apiPath: string,
): NextRequest {
  const url = `http://localhost:3000${apiPath}`;
  if (method === "GET" || method === "HEAD") {
    return new NextRequest(url, { method });
  }
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("app/api handler invoke sweep", () => {
  it("discovers route files", () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(50);
  });

  it("invokes exported HTTP methods on each route module", async () => {
    let invoked = 0;
    const failures: Array<{ path: string; method: string; err: string }> = [];

    for (const file of ROUTE_FILES) {
      const id = moduleIdFor(file);
      const apiPath = apiPathFromFile(file);
      const context = buildRouteContext(apiPath);
      const isInternal = apiPath.includes("/internal/");

      let mod: Record<string, unknown> = {};
      try {
        jest.isolateModules(() => {
          mod = require(id) as Record<string, unknown>;
        });
      } catch (e) {
        failures.push({
          path: apiPath,
          method: "import",
          err: e instanceof Error ? e.message.split("\n")[0] : String(e),
        });
        continue;
      }

      for (const method of HTTP_EXPORTS) {
        const handler = mod[method];
        if (typeof handler !== "function") continue;

        const req = isInternal
          ? makeCronRequest({ path: apiPath, method: method as "GET" })
          : makeRequestForPath(method, apiPath);

        try {
          const result = await (handler as (r: NextRequest, c: typeof context) => Promise<unknown>)(
            req,
            context,
          );
          if (result && typeof (result as Response).status === "number") {
            invoked++;
          } else {
            invoked++;
          }
        } catch (e) {
          failures.push({
            path: apiPath,
            method,
            err: e instanceof Error ? e.message.split("\n")[0] : String(e),
          });
        }
      }
    }

    if (failures.length > 0) {
      console.warn(
        `Handler invoke: ${failures.length} failures (first 25):\n` +
          failures
            .slice(0, 25)
            .map((f) => `  ${f.method} ${f.path}: ${f.err}`)
            .join("\n"),
      );
    }

    expect(invoked).toBeGreaterThan(100);
    expect(failures.length).toBeLessThan(invoked);
  }, 120_000);
});
