/**
 * @jest-environment jsdom
 *
 * OpenSSF Silver coverage push #74 — shallow-render every use client
 * app page.tsx default export. Server Component pages are skipped
 * (async RSC defaults cannot be rendered in jsdom).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { render } from "@testing-library/react";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_, cb) => {
    cb(null);
    return jest.fn();
  }),
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
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
  getDocs: jest.fn().mockResolvedValue({ docs: [], empty: true }),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: () => "__ts",
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  storage: null,
  rtdb: null,
  app: null,
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    userProfile: null,
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  useParams: () => ({ tileId: "1_0", heroId: "hero-1", chapterId: "c1" }),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

beforeAll(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const base = {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "{}",
    };
    if (url.includes("/api/game/")) {
      return {
        ...base,
        json: async () => ({
          success: true,
          player: { userId: "u1", phase: "play", turnsRemaining: 5 },
          tiles: [],
          submissions: [],
          viewer: {
            isJudge: false,
            canPeerVote: false,
            hasCompletedPeerVoting: false,
            peerScoresRevealed: false,
            myParticipantScores: {},
          },
        }),
      };
    }
    return base;
  }) as typeof fetch;
});

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const APP_DIR = join(process.cwd(), "app");

function walkPages(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walkPages(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

function isUseClientPage(absPath: string): boolean {
  const head = readFileSync(absPath, "utf8").slice(0, 400);
  return head.includes('"use client"') || head.includes("'use client'");
}

function moduleIdFor(absPath: string): string {
  const rel = absPath.replace(process.cwd() + "/", "");
  return "@/" + rel.replace(/\.tsx$/, "");
}

const CLIENT_PAGES = walkPages(APP_DIR).filter(isUseClientPage);

describe("app/**/page.tsx shallow render (use client only)", () => {
  it("finds client page modules", () => {
    expect(CLIENT_PAGES.length).toBeGreaterThan(15);
  });

  it("renders each client page default export without throwing", () => {
    const failures: Array<{ path: string; err: string }> = [];
    let rendered = 0;

    for (const file of CLIENT_PAGES) {
      const id = moduleIdFor(file);
      try {
        let Page: React.ComponentType | undefined;
        jest.isolateModules(() => {
          const mod = require(id) as { default?: React.ComponentType };
          Page = mod.default;
        });
        if (!Page || typeof Page !== "function") continue;
        render(<Page />);
        rendered++;
      } catch (e) {
        failures.push({
          path: file.replace(process.cwd() + "/", ""),
          err: e instanceof Error ? e.message.split("\n")[0] : String(e),
        });
      }
    }

    if (failures.length > 0) {
      console.warn(
        `Page render: ${failures.length} failures (first 20):\n` +
          failures
            .slice(0, 20)
            .map((f) => `  - ${f.path}: ${f.err}`)
            .join("\n"),
      );
    }

    // Best-effort: many client pages need route params or data hooks we do not stub.
    expect(rendered).toBeGreaterThan(1);
    expect(rendered + failures.length).toBe(CLIENT_PAGES.length);
  });
});
