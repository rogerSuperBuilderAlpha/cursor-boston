/**
 * @jest-environment jsdom
 *
 * Targeted renders for high-LOC pages that shallow-render often skips.
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_, cb) => {
    cb(null);
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
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
  onSnapshot: jest.fn(),
  serverTimestamp: () => "__ts",
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
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => "{}",
  }) as typeof fetch;
});

const PAGES: Array<{ name: string; loader: () => Promise<{ default: React.ComponentType }> }> = [
  { name: "mentorship", loader: () => import("@/app/mentorship/page") },
  { name: "pair", loader: () => import("@/app/pair/page") },
  { name: "hackathons/pool", loader: () => import("@/app/hackathons/pool/page") },
  { name: "hackathons/team", loader: () => import("@/app/hackathons/team/page") },
  { name: "hackathons/teams", loader: () => import("@/app/hackathons/teams/page") },
  { name: "cfp", loader: () => import("@/app/cfp/page") },
  { name: "login", loader: () => import("@/app/(auth)/login/page") },
];

describe("high-value page renders", () => {
  it.each(PAGES)("renders $name without throwing", async ({ loader }) => {
    const { default: Page } = await loader();
    const { container } = render(<Page />);
    await waitFor(() => expect(container).toBeTruthy());
  });
});
