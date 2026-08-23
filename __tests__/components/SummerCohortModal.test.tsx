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

const mockUsePathname = jest.fn();

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
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/");
  });

  it("auto-opens on first visit (no localStorage flag for today)", async () => {
    render(<SummerCohortModal />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Hult Summer Hackathon/i })
    ).toBeInTheDocument();
  });

  it("directs visitors to the Monday Aug 24 Hult event", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    expect(screen.getByText(/This Monday/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Hult International Business School/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Monday, August 24/i)).toBeInTheDocument();
    expect(screen.getByText(/1:00 – 5:00 PM ET/i)).toBeInTheDocument();
  });

  it("primary CTA RSVPs on Luma and links event details on-site", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    const cta = screen.getByRole("link", { name: /rsvp on luma/i });
    expect(cta).toHaveAttribute("href", "https://luma.com/s5wuujzl");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /event details/i })).toHaveAttribute(
      "href",
      "/events/cursor-boston-hult-summer-hackathon-2026"
    );
  });

  it("does not auto-open if today's date is already stored", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorageMock.getItem.mockReturnValueOnce(today);
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("auto-opens on /summer-cohort so the Monday event still surfaces there", async () => {
    mockUsePathname.mockReturnValue("/summer-cohort");
    render(<SummerCohortModal />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("does not auto-open on the event page itself", () => {
    mockUsePathname.mockReturnValue(
      "/events/cursor-boston-hult-summer-hackathon-2026"
    );
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("renders the explore-the-community footer chips (Discord, Events, PR Ideas)", async () => {
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    expect(screen.getByText(/explore the community/i)).toBeInTheDocument();
    const discord = screen.getByRole("link", { name: /discord/i });
    expect(discord).toHaveAttribute("href", expect.stringContaining("discord.gg"));
    expect(discord).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /^events$/i })).toHaveAttribute(
      "href",
      "/events"
    );
    expect(screen.getByRole("link", { name: /pr ideas/i })).toHaveAttribute(
      "href",
      "/pr-ideas"
    );
  });

  it("closes and writes today's date on close", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.click(
      screen.getByRole("button", { name: /close monday event announcement/i })
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SUMMER_COHORT_LOCALSTORAGE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("closes when Maybe later is clicked", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.click(screen.getByText("Maybe later"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
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
    expect(dialog).toHaveAttribute("aria-labelledby", "monday-event-title");
  });
});
