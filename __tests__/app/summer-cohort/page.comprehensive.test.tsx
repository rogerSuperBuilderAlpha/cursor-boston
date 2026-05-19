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
    githubInfo: { login: "comp-user" },
  }),
}));
jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => ({
    ...emptyDiscordConnection,
    discordInfo: { username: "comp#0000" },
  }),
}));

const mockUseAuth = useAuth as jest.Mock;

function baseApplication(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    email: "comp@test.com",
    name: "Comp User",
    phone: "555-0100",
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

function admittedReady(overrides: Record<string, unknown> = {}) {
  return baseApplication({
    status: "admitted",
    mayImmersionRsvped: true,
    cohort1DevEnvConfirmedAt: Date.now(),
    ...overrides,
  });
}

function setupFetchHandlers(
  application: Record<string, unknown> | null,
  options: {
    intakeCompleted?: boolean;
    intakeError?: boolean;
    applyLoadError?: boolean;
  } = {},
) {
  const { intakeCompleted = true, intakeError = false, applyLoadError = false } =
    options;

  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/api/summer-cohort/apply") && method === "GET") {
        if (applyLoadError) {
          return { ok: false, json: async () => ({ error: "load_failed" }) };
        }
        return {
          ok: true,
          json: async () => ({
            application,
            applicationCounts: { "cohort-1": 42, "cohort-2": 18 },
          }),
        };
      }

      if (url.includes("/api/summer-cohort/apply") && method === "DELETE") {
        return { ok: true, json: async () => ({ ok: true }) };
      }

      if (url.includes("/api/summer-cohort/apply") && method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const next = application
          ? { ...application, ...body }
          : { ...baseApplication(), status: "pending", ...body };
        return {
          ok: true,
          json: async () => ({
            application: next,
            applicationCounts: { "cohort-1": 43, "cohort-2": 18 },
          }),
        };
      }

      if (url.includes("/api/summer-cohort/intake-survey")) {
        const cohortMatch = url.match(/cohortId=([^&]+)/);
        const cohortId = cohortMatch?.[1] ?? "cohort-1";
        if (method === "GET") {
          if (intakeError) {
            return { ok: false, json: async () => ({ error: "fail" }) };
          }
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

      if (url.includes("/api/summer-cohort/confirm-dev-env")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            cohort1DevEnvConfirmedAt: Date.now(),
          }),
        };
      }

      return { ok: true, json: async () => ({}) };
    },
  ) as typeof fetch;
}

async function renderAdmittedDashboard(
  overrides: Record<string, unknown> = {},
  fetchOptions: Parameters<typeof setupFetchHandlers>[1] = {},
) {
  setupFetchHandlers(admittedReady(overrides), {
    intakeCompleted: true,
    ...fetchOptions,
  });
  const Page = (await import("@/app/summer-cohort/page")).default;
  const user = userEvent.setup();
  render(<Page />);
  await waitFor(() => {
    expect(screen.getByText(/Status: Admitted/i)).toBeInTheDocument();
  });
  return user;
}

describe("summer-cohort page comprehensive", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    mockRouterReplace.mockClear();
    localStorage.clear();
    window.confirm = jest.fn(() => true);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { displayName: "Comp User", photoURL: null },
      loading: false,
      refreshUserProfile: jest.fn(),
    });
  });

  it("shows signed-out apply prompt without calling apply API", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    setupFetchHandlers(null);
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: /Create an account to apply/i }),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/summer-cohort/apply"),
      expect.anything(),
    );
  });

  it("shows application load error when GET apply fails", async () => {
    setupFetchHandlers(baseApplication(), { applyLoadError: true });
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/Couldn't load your application status/i),
    ).toBeInTheDocument();
  });

  it("renders rejected status panel", async () => {
    setupFetchHandlers(baseApplication({ status: "rejected", cohorts: ["cohort-2"] }));
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Status: Not selected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/apply to a future cohort/i),
    ).toBeInTheDocument();
  });

  it("renders waitlist status panel", async () => {
    setupFetchHandlers(baseApplication({ status: "waitlist" }));
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Status: Waitlist/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You're on the waitlist for/i),
    ).toBeInTheDocument();
  });

  it("shows pending status with missing disclosure todo", async () => {
    setupFetchHandlers(
      baseApplication({
        status: "pending",
        isLocal: null,
        wantsToPresent: null,
      }),
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Status: Pending/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Fill in the two new questions/i),
    ).toBeInTheDocument();
  });

  it("shows immersion RSVP todo for cohort-1 pending applicants", async () => {
    setupFetchHandlers(
      baseApplication({
        status: "pending",
        mayImmersionRsvped: false,
      }),
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/RSVP for Mon, May 26 on Luma/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reserve your spot/i })).toHaveAttribute(
      "href",
      expect.stringContaining("luma.com"),
    );
  });

  it("auto-opens intake survey tab when incomplete for admitted user", async () => {
    setupFetchHandlers(admittedReady(), { intakeCompleted: false });
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/Why did you join the program/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /intake survey/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("navigates cohort info tab for admitted dashboard", async () => {
    const user = await renderAdmittedDashboard();
    await user.click(document.getElementById("tab-info")!);

    await waitFor(() => {
      expect(screen.getByText(/You're in! Welcome to Cohort 1/i)).toBeInTheDocument();
    });
  });

  it("navigates setup instructions tab", async () => {
    const user = await renderAdmittedDashboard();
    await user.click(document.getElementById("tab-setup")!);

    expect(await screen.findByText(/Get your machine ready/i)).toBeInTheDocument();
  });

  it("navigates game promo tab", async () => {
    const user = await renderAdmittedDashboard();
    await user.click(document.getElementById("tab-game")!);

    expect(await screen.findByText(/The Cursor Boston game/i)).toBeInTheDocument();
  });

  it("navigates week 1 through week 6 tabs", async () => {
    const user = await renderAdmittedDashboard();

    const weekChecks: Array<[string, RegExp]> = [
      ["tab-week-1", /Project Management Build/i],
      ["tab-week-2", /Communications Build/i],
      ["tab-week-3", /Vibe Marketing Build/i],
      ["tab-week-4", /Ludwitt Education Tool/i],
      ["tab-week-5", /Your Own Startup/i],
      ["tab-week-6", /Open-Source PR/i],
    ];

    for (const [tabId, headingPattern] of weekChecks) {
      await user.click(document.getElementById(tabId)!);
      expect(
        await screen.findByRole("heading", { name: headingPattern }),
      ).toBeInTheDocument();
    }
  });

  it("shows my info tab with connections and your details", async () => {
    const user = await renderAdmittedDashboard();
    await user.click(document.getElementById("tab-my-info")!);

    expect(await screen.findByText(/Connect your accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/Your details/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected as comp-user/i)).toBeInTheDocument();
  });

  it("withdraws application after confirmation", async () => {
    setupFetchHandlers(baseApplication({ status: "pending" }));
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText(/Status: Pending/i);
    await user.click(await screen.findByRole("button", { name: /^Edit$/i }));
    const withdrawBtn = await screen.findByRole("button", {
      name: /Withdraw application/i,
    });
    await user.click(withdrawBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/summer-cohort/apply",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByRole("heading", { name: /^Apply$/i })).toBeInTheDocument();
  });

  it("opens intake survey via banner when survey incomplete", async () => {
    setupFetchHandlers(admittedReady(), { intakeCompleted: false });
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText(/Why did you join the program/i);
    await user.click(screen.getByRole("tab", { name: /cohort info/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Why did you join the program/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Take it/i }));

    expect(
      await screen.findByText(/Why did you join the program/i),
    ).toBeInTheDocument();
  });

  it("shows observer panel when admitted user switches to non-home cohort", async () => {
    currentSearchParams = new URLSearchParams("cohort=cohort-2");
    setupFetchHandlers(
      admittedReady({ cohorts: ["cohort-1"] }),
      { intakeCompleted: true },
    );
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Observer view — Cohort 2/i)).toBeInTheDocument();
    const cohortNav = screen.getByRole("tablist", { name: /cohort selector/i });
    expect(within(cohortNav).getByRole("tab", { name: /Cohort 2/i })).toBeInTheDocument();
  });
});
