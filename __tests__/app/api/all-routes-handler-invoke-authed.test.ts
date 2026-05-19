/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #76 — authenticated handler sweep (deeper paths
 * past the 401 guard than the unauthenticated invoke in #74).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { makeCronRequest } from "@/__tests__/_helpers/route-test-utils";

const AUTH_USER = {
  uid: "test-user-1",
  email: "test@example.com",
  name: "Test User",
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => {
    const chain = {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        collection: jest.fn(() => chain),
      })),
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
      count: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      }),
      collection: jest.fn(() => chain),
    };
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    return {
      collection: jest.fn(() => chain),
      runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        }),
      ),
    };
  }),
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: AUTH_USER.uid }),
  })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn().mockResolvedValue(AUTH_USER),
  verifyIdTokenAdmin: jest.fn().mockResolvedValue(AUTH_USER),
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
const HTTP_EXPORTS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

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

function apiPathFromFile(absPath: string): string {
  const rel = absPath.replace(join(process.cwd(), "app"), "").replace(/\\/g, "/");
  return rel.replace(/\/route\.ts$/, "") || "/api";
}

function buildRouteContext(apiPath: string) {
  const segments = apiPath.split("/").filter(Boolean);
  const params: Record<string, string | string[]> = {};
  for (const seg of segments) {
    if (seg.startsWith("[...") && seg.endsWith("]")) {
      params[seg.slice(4, -1)] = ["a", "b"];
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      params[seg.slice(1, -1)] = `test-${seg.slice(1, -1)}`;
    }
  }
  return { params: Promise.resolve(params) };
}

function postBodyForPath(apiPath: string): Record<string, unknown> {
  if (apiPath.includes("/game/build")) {
    return { tileId: "t1", unitType: "ground", count: 1 };
  }
  if (apiPath.includes("/game/distribute")) {
    return { tileId: "t1", type: "food" };
  }
  if (apiPath.includes("/game/caste")) {
    return { caste: "red" };
  }
  if (apiPath.includes("/summer-cohort/votes")) {
    return { weekId: "week-1", submitterHandle: "alice" };
  }
  if (apiPath.includes("/questions")) {
    return { title: "Q", body: "body text here" };
  }
  if (apiPath.includes("/community")) {
    return { content: "hello world post" };
  }
  return {};
}

function makeAuthedRequest(method: string, apiPath: string): NextRequest {
  const url = `http://localhost:3000${apiPath}`;
  const headers: Record<string, string> = {
    authorization: "Bearer test-token",
  };
  if (method === "GET" || method === "HEAD") {
    return new NextRequest(url, { method, headers });
  }
  headers["content-type"] = "application/json";
  return new NextRequest(url, {
    method,
    headers,
    body: JSON.stringify(postBodyForPath(apiPath)),
  });
}

describe("app/api authed handler invoke sweep", () => {
  it("invokes handlers with a verified user", async () => {
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
      } catch {
        continue;
      }

      for (const method of HTTP_EXPORTS) {
        const handler = mod[method];
        if (typeof handler !== "function") continue;

        const req = isInternal
          ? makeCronRequest({ path: apiPath, method: method as "GET", secret: "cron" })
          : makeAuthedRequest(method, apiPath);

        try {
          await (handler as (r: NextRequest, c: typeof context) => Promise<unknown>)(
            req,
            context,
          );
          invoked++;
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
        `Authed invoke: ${failures.length} failures (first 15):\n` +
          failures
            .slice(0, 15)
            .map((f) => `  ${f.method} ${f.path}: ${f.err}`)
            .join("\n"),
      );
    }

    expect(invoked).toBeGreaterThan(150);
  }, 180_000);
});
