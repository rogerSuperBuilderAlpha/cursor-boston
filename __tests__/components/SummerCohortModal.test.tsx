/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_OPEN_EVENT,
} from "@/lib/summer-cohort";

// Mock the AuthContext + usePathname BEFORE importing the modal so the
// modal sees the mock instead of pulling in firebase at module-load time.
const mockUseAuth = jest.fn();
const mockUsePathname = jest.fn();

jest.mock("@/contexts/AuthContext", () => ({
  __esModule: true,
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => mockUsePathname(),
}));

import SummerCohortModal from "@/components/SummerCohortModal";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("SummerCohortModal", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/");
  });

  it("auto-opens on first visit (no localStorage flag for today)", async () => {
    render(<SummerCohortModal />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // Every visitor sees the Hult launch headline.
    expect(
      screen.getByRole("heading", { name: /Hult Cohort Developer Program/i })
    ).toBeInTheDocument();
  });

  it("surfaces the Hult launch message and July 13 start date", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    expect(screen.getByText(/Launching soon/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Hult International Business School/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Monday, July 13/i)).toBeInTheDocument();
  });

  it("does not auto-open if today's date is already stored", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorageMock.getItem.mockReturnValueOnce(today);
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("now auto-opens on /summer-cohort (Hult transition surfaces it everywhere)", async () => {
    mockUsePathname.mockReturnValue("/summer-cohort");
    render(<SummerCohortModal />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("does not auto-open on /contribute/game-art", () => {
    mockUsePathname.mockReturnValue("/contribute/game-art");
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not auto-open on /signup or /login (don't disrupt the auth flow)", () => {
    mockUsePathname.mockReturnValue("/signup");
    const { unmount } = render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    mockUsePathname.mockReturnValue("/login");
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("logged-out users get a Create-account-and-register primary CTA pointing to /signup with redirect", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    const cta = screen.getByRole("link", { name: /create account.*register/i });
    expect(cta).toHaveAttribute(
      "href",
      "/signup?redirect=%2Fsummer-cohort"
    );
  });

  it("logged-out users also see a secondary Sign in link with redirect preserved", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    const cta = screen.getByRole("link", { name: /^sign in$/i });
    expect(cta).toHaveAttribute(
      "href",
      "/login?redirect=%2Fsummer-cohort"
    );
  });

  it("renders the explore-the-community footer chips (Discord, Events, PR Ideas)", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    expect(screen.getByText(/explore the community/i)).toBeInTheDocument();
    const discord = screen.getByRole("link", { name: /discord/i });
    expect(discord).toHaveAttribute("href", expect.stringContaining("discord.gg"));
    expect(discord).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /events/i })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: /pr ideas/i })).toHaveAttribute("href", "/pr-ideas");
  });

  it("logged-in user without an application gets a Register-for-Cohort-2 CTA (no Create-account button)", async () => {
    const fakeUser = {
      getIdToken: jest.fn().mockResolvedValue("fake-token"),
    } as unknown as {
      getIdToken: () => Promise<string>;
    };
    mockUseAuth.mockReturnValue({ user: fakeUser, loading: false });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ application: null }),
    });
    // @ts-expect-error - assigning a mock to the global fetch in the test env
    global.fetch = fetchMock;

    render(<SummerCohortModal />);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /register for cohort 2/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /register for cohort 2/i })
    ).toHaveAttribute("href", "/summer-cohort");
    // Logged-in path no longer surfaces the create-account fork.
    expect(
      screen.queryByRole("link", { name: /create account/i })
    ).not.toBeInTheDocument();
  });

  it("shows a registered confirmation (no register CTA) when the user has already applied", async () => {
    const fakeUser = {
      getIdToken: jest.fn().mockResolvedValue("fake-token"),
    } as unknown as {
      getIdToken: () => Promise<string>;
    };
    mockUseAuth.mockReturnValue({ user: fakeUser, loading: false });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ application: { userId: "u1" } }),
    });
    // @ts-expect-error - assigning a mock to the global fetch in the test env
    global.fetch = fetchMock;

    render(<SummerCohortModal />);
    await waitFor(() => {
      // Match without the apostrophe (rendered as a curly &rsquo;).
      expect(
        screen.getByText(/registered for Cohort 2/i)
      ).toBeInTheDocument();
    });
    // Registered users no longer see a register/apply CTA.
    expect(
      screen.queryByRole("link", { name: /register for cohort 2/i })
    ).not.toBeInTheDocument();
  });

  it("closes and writes today's date on close", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.click(
      screen.getByRole("button", { name: /close cohort announcement/i })
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SUMMER_COHORT_LOCALSTORAGE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Maybe later is clicked", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.click(screen.getByText("Maybe later"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("re-opens on the open-summer-cohort-modal custom event", async () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorageMock.getItem.mockReturnValueOnce(today);
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(SUMMER_COHORT_OPEN_EVENT));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has aria-modal and aria-labelledby on the dialog", async () => {
    render(<SummerCohortModal />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "summer-cohort-title");
  });
});
