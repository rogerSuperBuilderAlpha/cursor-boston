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
    expect(
      screen.getByText("Cursor Boston Summer Cohort")
    ).toBeInTheDocument();
  });

  it("does not auto-open if today's date is already stored", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorageMock.getItem.mockReturnValueOnce(today);
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not auto-open on suppressed pathnames (/summer-cohort)", () => {
    mockUsePathname.mockReturnValue("/summer-cohort");
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not auto-open on /contribute/game-art", () => {
    mockUsePathname.mockReturnValue("/contribute/game-art");
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders both cohort rows; cohort 1 marked Closed", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    expect(screen.getByText("Cohort 1")).toBeInTheDocument();
    expect(screen.getByText("Cohort 2")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("default CTA is Apply → /summer-cohort for signed-out users", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    const cta = screen.getByRole("link", { name: /^apply/i });
    expect(cta).toHaveAttribute("href", "/summer-cohort");
  });

  it("includes the May 26 immersion link as an external link", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    const link = screen.getByRole("link", {
      name: /Hult \/ Cursor Boston immersion/i,
    });
    expect(link).toHaveAttribute("href", expect.stringContaining("luma.com"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("includes the designer-contribute internal link", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    const link = screen.getByRole("link", {
      name: /Contribute art to the game/i,
    });
    expect(link).toHaveAttribute("href", "/contribute/game-art");
  });

  it("swaps CTA to View-your-cohort when the user has already applied", async () => {
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
      expect(
        screen.getByRole("link", { name: /View your cohort/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /View your cohort/i })
    ).toHaveAttribute("href", "/summer-cohort");
  });

  it("keeps Apply CTA when fetch returns no application", async () => {
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
        screen.getByRole("link", { name: /^apply/i })
      ).toBeInTheDocument();
    });
  });

  it("closes and writes today's date on close", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.click(
      screen.getByRole("button", { name: /close summer cohort/i })
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
