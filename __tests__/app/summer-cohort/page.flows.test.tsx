/**
 * @jest-environment jsdom
 */

let currentSearchParams = new URLSearchParams();
export const mockRouterReplace = jest.fn((href: string) => {
  const queryIndex = href.indexOf("?");
  currentSearchParams =
    queryIndex >= 0
      ? new URLSearchParams(href.slice(queryIndex + 1))
      : new URLSearchParams();
});

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  storage: null,
  rtdb: null,
  app: null,
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_, cb) => {
    cb(null);
    return jest.fn();
  }),
  getIdToken: jest.fn(
    (user) => user?.getIdToken?.() ?? Promise.resolve("test-token"),
  ),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: class {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  addDoc: jest.fn().mockResolvedValue({ id: "new-doc" }),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => false,
    data: () => undefined,
  }),
  getDocs: jest.fn().mockResolvedValue({ docs: [], empty: true }),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: () => "__ts",
  Timestamp: {
    fromMillis: (ms: number) => ({ toDate: () => new Date(ms) }),
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => "/summer-cohort",
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => require("react").createElement("a", { href }, children),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: null,
    userProfile: null,
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components/SectionHelp", () => ({
  SectionHelp: () => null,
}));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: () => null,
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import {
  emptyDiscordConnection,
  emptyGithubConnection,
  makeAuthUser,
} from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/app/(auth)/profile/_hooks/useGithubConnection", () => ({
  useGithubConnection: () => ({
    ...emptyGithubConnection,
    githubInfo: { login: "flow-user" },
  }),
}));
jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => ({
    ...emptyDiscordConnection,
    discordInfo: { username: "flow#0000" },
  }),
}));

const mockUseAuth = useAuth as jest.Mock;

function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    email: "flow@test.com",
    name: "Flow User",
    phone: "555-0199",
    cohorts: ["cohort-1"],
    siteId: null,
    status: "pending",
    isLocal: true,
    wantsToPresent: true,
    mayImmersionRsvped: false,
    cohort1DevEnvConfirmedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function setupFetchHandlers(
  application: Record<string, unknown> | null,
  options: {
    intakeCompleted?: boolean;
    onPostApply?: (body: string) => Record<string, unknown>;
  } = {},
) {
  const { intakeCompleted = true, onPostApply } = options;
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/api/summer-cohort/apply") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            application,
            applicationCounts: { "cohort-1": 42, "cohort-2": 18 },
          }),
        };
      }

      if (url.includes("/api/summer-cohort/apply") && method === "POST") {
        const body = init?.body ? String(init.body) : "{}";
        const posted = onPostApply?.(body);
        const nextApplication =
          posted ??
          (application
            ? { ...application, ...(JSON.parse(body) as object) }
            : {
                ...baseApplication(),
                status: "pending",
                ...(JSON.parse(body) as object),
              });
        return {
          ok: true,
          json: async () => ({
            application: nextApplication,
            applicationCounts: { "cohort-1": 43, "cohort-2": 18 },
          }),
        };
      }

      if (url.includes("/api/summer-cohort/intake-survey")) {
        const cohortMatch = url.match(/cohortId=([^&]+)/);
        const cohortId = cohortMatch?.[1] ?? "cohort-1";
        if (method === "GET") {
          return {
            ok: true,
            json: async () => ({ completed: intakeCompleted, cohortId }),
          };
        }
        return { ok: true, json: async () => ({ success: true }) };
      }

      if (url.includes("/api/summer-cohort/submissions/")) {
        return {
          ok: true,
          json: async () => ({
            submissions: [],
            merged: null,
            tryingToWin: null,
          }),
        };
      }

      if (url.includes("/api/summer-cohort/my-score")) {
        return { ok: true, json: async () => ({ score: null }) };
      }

      return { ok: true, json: async () => ({}) };
    },
  ) as typeof fetch;
}

describe("summer-cohort page flows", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    mockRouterReplace.mockClear();
    localStorage.clear();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { displayName: "Flow User", photoURL: null },
      loading: false,
      refreshUserProfile: jest.fn(),
    });
  });

  it("renders rejected application status panel", async () => {
    setupFetchHandlers(
      baseApplication({ status: "rejected", cohorts: ["cohort-2"] }),
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Status: Not selected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We weren't able to fit you into this cohort round/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/apply to a future cohort/i),
    ).toBeInTheDocument();
  });

  it("renders admitted dashboard with cohort tab navigation", async () => {
    setupFetchHandlers(
      baseApplication({
        status: "admitted",
        mayImmersionRsvped: true,
        cohort1DevEnvConfirmedAt: Date.now(),
      }),
      { intakeCompleted: true },
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    expect(await screen.findByText(/Status: Admitted/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /cohort info/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /week 2: comms/i }));

    await waitFor(() => {
      expect(screen.getByText(/Week 2: Comms/i)).toBeInTheDocument();
    });
  });

  it("submits new applicant via POST /api/summer-cohort/apply", async () => {
    setupFetchHandlers(null);
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Apply$/i })).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/^Name$/i), "New Applicant");
    await user.type(screen.getByLabelText(/^Phone$/i), "555-1000");
    await user.click(
      screen.getByRole("radio", {
        name: /Yes — I'm local and plan to attend live events/i,
      }),
    );
    await user.click(
      screen.getByRole("radio", {
        name: /Yes — count me in to present and maintain/i,
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /Submit application/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/summer-cohort/apply",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("New Applicant"),
        }),
      );
    });

    expect(await screen.findByText(/Status: Pending/i)).toBeInTheDocument();
  });

  it("switches cohort via CohortSwitcher and refetches intake for cohort-2", async () => {
    setupFetchHandlers(
      baseApplication({
        status: "admitted",
        cohorts: ["cohort-1", "cohort-2"],
        mayImmersionRsvped: true,
        cohort1DevEnvConfirmedAt: Date.now(),
      }),
      { intakeCompleted: false },
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    const { rerender } = render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Admitted/i)).toBeInTheDocument();
    });

    const cohortNav = screen.getByRole("tablist", { name: /cohort selector/i });
    await user.click(
      within(cohortNav).getByRole("tab", { name: /Cohort 2/i }),
    );

    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("cohort=cohort-2"),
      expect.anything(),
    );

    rerender(<Page />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/summer-cohort/intake-survey?cohortId=cohort-2",
        ),
        expect.anything(),
      );
    });
  });

  it("loads cohort-2 observer-style content when URL selects cohort-2 for c1-only admit", async () => {
    currentSearchParams = new URLSearchParams("cohort=cohort-2");
    setupFetchHandlers(
      baseApplication({
        status: "admitted",
        cohorts: ["cohort-1"],
        mayImmersionRsvped: true,
        cohort1DevEnvConfirmedAt: Date.now(),
      }),
      { intakeCompleted: true },
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Observer view — Cohort 2/i)).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => {
        const text = el?.textContent ?? "";
        return (
          el?.tagName === "P" &&
          text.includes("You're admitted to") &&
          text.includes("Cohort 1") &&
          text.includes("Cohort 2")
        );
      }),
    ).toBeInTheDocument();
  });

  it("shows immersion RSVP todo when mayImmersionRsvped is false", async () => {
    setupFetchHandlers(
      baseApplication({
        status: "pending",
        cohorts: ["cohort-1"],
        mayImmersionRsvped: false,
      }),
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Status: Pending/i)).toBeInTheDocument();
    expect(
      screen.getByText(/RSVP for Mon, May 26 on Luma/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reserve your spot/i })).toHaveAttribute(
      "href",
      expect.stringContaining("luma.com"),
    );
  });

  it("shows immersion RSVP confirmed when mayImmersionRsvped is true", async () => {
    setupFetchHandlers(
      baseApplication({
        status: "admitted",
        mayImmersionRsvped: true,
        cohort1DevEnvConfirmedAt: Date.now(),
      }),
      { intakeCompleted: true },
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Admitted/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /cohort info/i }));

    expect(await screen.findByText(/Setup recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/RSVP confirmed/i)).toBeInTheDocument();
  });
});
