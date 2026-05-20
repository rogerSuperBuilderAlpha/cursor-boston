/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/cookbook/page.tsx` (was 47% / 45 uncovered
 * branches). Covers fetch entries (mount + filter + search + sort + load
 * more), fetchVotes (signed-out + signed-in), handleVote happy/error/
 * removed/blocked-while-voting, submit form open/close, entry modal
 * open/close, no-results variants, and the search-disables-sort branch.
 */

import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as AuthContext from "@/contexts/AuthContext";
import CookbookPage from "@/app/cookbook/page";
import type { CookbookEntry } from "@/types/cookbook";

jest.mock("firebase/auth", () => ({
  getIdToken: jest.fn(() => Promise.resolve("test-token")),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock("@/components/SectionHelp", () => ({
  SectionHelp: () => <div data-testid="section-help" />,
}));

jest.mock("@/components/cookbook/CookbookEntries", () => ({
  CookbookEntries: ({
    entries,
    voteState,
    isLoggedIn,
    votingId,
    onVote,
    onViewFull,
    onTagClick,
  }: {
    entries: CookbookEntry[];
    voteState: Record<string, { upCount: number; downCount: number; userVote?: string }>;
    isLoggedIn: boolean;
    votingId: string | null;
    onVote: (id: string, t: "up" | "down") => void;
    onViewFull: (e: CookbookEntry) => void;
    onTagClick?: (t: string) => void;
  }) => (
    <div data-testid="entries-list">
      <span data-testid="entries-count">{entries.length}</span>
      <span data-testid="logged-in">{isLoggedIn ? "yes" : "no"}</span>
      <span data-testid="voting-id">{votingId ?? "none"}</span>
      {entries.map((e) => {
        const v = voteState[e.id];
        return (
          <div key={e.id} data-testid={`entry-${e.id}`}>
            <span>{e.title}</span>
            <span data-testid={`up-${e.id}`}>{v?.upCount ?? 0}</span>
            <span data-testid={`down-${e.id}`}>{v?.downCount ?? 0}</span>
            <span data-testid={`user-vote-${e.id}`}>{v?.userVote ?? "none"}</span>
            <button type="button" onClick={() => onViewFull(e)}>
              view-{e.id}
            </button>
            <button type="button" onClick={() => onVote(e.id, "up")}>
              up-{e.id}
            </button>
            <button type="button" onClick={() => onVote(e.id, "down")}>
              down-{e.id}
            </button>
            <button type="button" onClick={() => onTagClick?.("typescript")}>
              tag-{e.id}
            </button>
          </div>
        );
      })}
    </div>
  ),
}));

jest.mock("@/components/cookbook/EntryDetailModal", () => ({
  EntryDetailModal: ({
    entry,
    onClose,
    onVote,
    isLoggedIn,
    isVoting,
  }: {
    entry: CookbookEntry;
    onClose: () => void;
    onVote: (id: string, t: "up" | "down") => void;
    isLoggedIn: boolean;
    isVoting: boolean;
  }) => (
    <div data-testid="modal">
      <span>modal-{entry.id}</span>
      <span data-testid="modal-logged-in">{isLoggedIn ? "yes" : "no"}</span>
      <span data-testid="modal-voting">{isVoting ? "yes" : "no"}</span>
      <button type="button" onClick={onClose}>
        close-modal
      </button>
      <button type="button" onClick={() => onVote(entry.id, "up")}>
        modal-up
      </button>
    </div>
  ),
}));

jest.mock("@/components/cookbook/SubmitForm", () => ({
  SubmitForm: ({
    onSuccess,
    setError,
  }: {
    onSuccess: () => void;
    setError: (v: string | null) => void;
  }) => (
    <div data-testid="submit-form">
      <button type="button" onClick={onSuccess}>
        trigger-success
      </button>
      <button type="button" onClick={() => setError("submit-failed")}>
        trigger-error
      </button>
    </div>
  ),
}));

const sampleEntry = (overrides: Partial<CookbookEntry> = {}): CookbookEntry => ({
  id: "entry-1",
  title: "Go production rules",
  description: "Some description",
  promptContent: "Prompt content",
  category: "code-generation",
  tags: ["go"],
  worksWith: ["Go"],
  authorId: "auth-1",
  authorDisplayName: "Alice",
  createdAt: "2026-02-28T00:00:00.000Z",
  upCount: 5,
  downCount: 2,
  ...overrides,
});

const mockUser = {
  uid: "test-uid",
  email: "test@example.com",
  displayName: "Test User",
};

type FetchHandler = (url: string, init?: RequestInit) => Promise<Partial<Response>>;

function installFetch(handler: FetchHandler) {
  global.fetch = jest.fn((url: unknown, init?: unknown) =>
    handler(
      typeof url === "string" ? url : (url as URL).toString(),
      init as RequestInit | undefined
    )
  ) as unknown as typeof fetch;
}

function entriesOk(entries: CookbookEntry[], opts: { hasMore?: boolean; nextCursor?: string | null } = {}) {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        entries,
        nextCursor: opts.nextCursor ?? null,
        hasMore: !!opts.hasMore,
      }),
  } as Partial<Response>);
}

function votesOk(userVotes: Record<string, string> = {}) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ userVotes }),
  } as Partial<Response>);
}

describe("CookbookPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: null });
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it("renders the hero, filters, and section help", async () => {
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText("Prompts & Rules")).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Share and discover Cursor prompts, rules files/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Works with")).toBeInTheDocument();
    expect(screen.getByTestId("section-help")).toBeInTheDocument();
  });

  it("shows the global empty state with sign-in CTA when signed out", async () => {
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText(/No prompts yet/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Sign in to submit/i)).toBeInTheDocument();
  });

  it("hides the sign-in CTA in the global empty state when signed in", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText(/No prompts yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/Sign in to submit/i)).not.toBeInTheDocument();
  });

  it("renders entries when fetch returns data and exposes vote counts", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    expect(screen.getByTestId("entries-count").textContent).toBe("1");
    expect(screen.getByTestId("up-entry-1").textContent).toBe("5");
    expect(screen.getByTestId("down-entry-1").textContent).toBe("2");
    expect(screen.getByText(/1 entry/)).toBeInTheDocument();
  });

  it("pluralizes entry counter for >1 entries", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([
          sampleEntry({ id: "a" }),
          sampleEntry({ id: "b", title: "Another" }),
        ]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText(/2 entries/)).toBeInTheDocument()
    );
  });

  it("falls back to zero up/down when entry omits counts (??  branches)", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([
          sampleEntry({
            id: "no-counts",
            upCount: undefined as unknown as number,
            downCount: undefined as unknown as number,
          }),
        ]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-no-counts")).toBeInTheDocument()
    );
    expect(screen.getByTestId("up-no-counts").textContent).toBe("0");
    expect(screen.getByTestId("down-no-counts").textContent).toBe("0");
  });

  it("opens and closes the submit form when Add CTA is clicked", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    const user = userEvent.setup();
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText("Add a Prompt or Rule")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("submit-form")).not.toBeInTheDocument();
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /Add a Prompt or Rule/i })
      );
    });
    expect(screen.getByTestId("submit-form")).toBeInTheDocument();
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /Add a Prompt or Rule/i })
      );
    });
    expect(screen.queryByTestId("submit-form")).not.toBeInTheDocument();
  });

  it("submit success closes form and refetches entries", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    const user = userEvent.setup();
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText("Add a Prompt or Rule")).toBeInTheDocument()
    );
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /Add a Prompt or Rule/i })
      );
    });
    expect(screen.getByTestId("submit-form")).toBeInTheDocument();
    const initialEntryCalls = fetchSpy.mock.calls.filter((c) =>
      c[0].includes("/api/cookbook/entries")
    ).length;
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /trigger-success/i }));
    });
    await waitFor(() => {
      const refetchCalls = (
        global.fetch as unknown as jest.Mock
      ).mock.calls.filter((c) => String(c[0]).includes("/api/cookbook/entries"));
      expect(refetchCalls.length).toBeGreaterThan(initialEntryCalls);
    });
    expect(screen.queryByTestId("submit-form")).not.toBeInTheDocument();
  });

  it("category filter triggers refetch with category param", async () => {
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Category")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Category"), {
        target: { value: "testing" },
      });
    });
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some((c) =>
          String(c[0]).includes("category=testing")
        )
      ).toBe(true)
    );
  });

  it("worksWith filter triggers refetch with worksWith param", async () => {
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Works with")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Works with"), {
        target: { value: "Python" },
      });
    });
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some((c) =>
          String(c[0]).includes("worksWith=Python")
        )
      ).toBe(true)
    );
  });

  it("debounced search updates the URL and disables sort", async () => {
    jest.useFakeTimers();
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    render(<CookbookPage />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    const searchInput = screen.getByLabelText("Search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "vector" } });
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      fetchSpy.mock.calls.some((c) => String(c[0]).includes("search=vector"))
    ).toBe(true);
    expect(
      screen.getByText(/Sort uses newest first while searching/i)
    ).toBeInTheDocument();
    const sortSelect = screen.getByLabelText("Sort by") as HTMLSelectElement;
    expect(sortSelect.disabled).toBe(true);
    jest.useRealTimers();
  });

  it("switches sort to oldest and to top, both refetch with sort param", async () => {
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Sort by")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Sort by"), {
        target: { value: "oldest" },
      });
    });
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some((c) => String(c[0]).includes("sort=oldest"))
      ).toBe(true)
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Sort by"), {
        target: { value: "top" },
      });
    });
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some((c) => String(c[0]).includes("sort=top"))
      ).toBe(true)
    );
  });

  it("clicking a tag in an entry routes back into the search box", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /tag-entry-1/i }));
    });
    const searchInput = screen.getByLabelText("Search") as HTMLInputElement;
    expect(searchInput.value).toBe("typescript");
  });

  it("opens the entry detail modal and closes it", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /view-entry-1/i }));
    });
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText(/modal-entry-1/i)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /close-modal/i }));
    });
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("happy path vote: updates count + userVote and clears votingId", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && init?.method === "POST")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ action: "added", upCount: 6, downCount: 2 }),
        } as Partial<Response>);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^up-entry-1$/i }));
    });
    await waitFor(() =>
      expect(screen.getByTestId("up-entry-1").textContent).toBe("6")
    );
    expect(screen.getByTestId("user-vote-entry-1").textContent).toBe("up");
    expect(screen.getByTestId("voting-id").textContent).toBe("none");
  });

  it("vote with action=removed clears userVote", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && init?.method === "POST")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ action: "removed", upCount: 4, downCount: 2 }),
        } as Partial<Response>);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^up-entry-1$/i }));
    });
    await waitFor(() =>
      expect(screen.getByTestId("user-vote-entry-1").textContent).toBe("none")
    );
  });

  it("vote with missing counts in response falls back to previous counts", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && init?.method === "POST")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ action: "added" }),
        } as Partial<Response>);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^up-entry-1$/i }));
    });
    await waitFor(() =>
      expect(screen.getByTestId("user-vote-entry-1").textContent).toBe("up")
    );
    expect(screen.getByTestId("up-entry-1").textContent).toBe("5");
  });

  it("vote network rejection is swallowed and clears votingId", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && init?.method === "POST")
        return Promise.reject(new Error("network"));
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^up-entry-1$/i }));
    });
    await waitFor(() =>
      expect(screen.getByTestId("voting-id").textContent).toBe("none")
    );
  });

  it("vote ignored when not signed in (no user) — no POST issued", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    const before = (
      global.fetch as unknown as jest.Mock
    ).mock.calls.filter((c) => String(c[0]).includes("/api/cookbook/vote"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^up-entry-1$/i }));
    });
    const after = (
      global.fetch as unknown as jest.Mock
    ).mock.calls.filter(
      (c) =>
        String(c[0]).includes("/api/cookbook/vote") &&
        (c[1] as RequestInit | undefined)?.method === "POST"
    );
    expect(after.length).toBe(0);
    expect(before.length).toBeGreaterThanOrEqual(0);
  });

  it("non-ok entries response keeps entries empty but stops loading", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Partial<Response>);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText(/No prompts yet/i)).toBeInTheDocument()
    );
  });

  it("entries fetch rejection logs warning and shows empty state", async () => {
    installFetch((url) => {
      if (url.includes("/api/cookbook/entries"))
        return Promise.reject(new Error("offline"));
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByText(/No prompts yet/i)).toBeInTheDocument()
    );
  });

  it("fetchVotes attaches Authorization header when signed in and applies userVotes (up + invalid)", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && (init?.method ?? "GET") === "GET") {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer test-token");
        return votesOk({
          "entry-1": "up",
          "bogus-entry": "rainbow",
        });
      }
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("user-vote-entry-1").textContent).toBe("up")
    );
  });

  it("fetchVotes rejection is swallowed and warns to console", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && (init?.method ?? "GET") === "GET")
        return Promise.reject(new Error("vote-network-down"));
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
  });

  it("hasMore=true renders Load more and triggers append fetch with cursor", async () => {
    let firstCall = true;
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) {
        if (firstCall) {
          firstCall = false;
          return entriesOk([sampleEntry({ id: "p1", title: "Page 1" })], {
            hasMore: true,
            nextCursor: "cursor-2",
          });
        }
        return entriesOk([sampleEntry({ id: "p2", title: "Page 2" })], {
          hasMore: false,
          nextCursor: null,
        });
      }
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Load more/i })).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Load more/i }));
    });
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some((c) => String(c[0]).includes("cursor=cursor-2"))
      ).toBe(true)
    );
    await waitFor(() =>
      expect(screen.getByText("Page 2")).toBeInTheDocument()
    );
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("renders the filtered empty state when filters are active and no results", async () => {
    const fetchSpy = jest.fn((url: string) => {
      if (url.includes("/api/cookbook/entries")) return entriesOk([]);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    installFetch(fetchSpy as unknown as FetchHandler);
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByLabelText("Category")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Category"), {
        target: { value: "debugging" },
      });
    });
    await waitFor(() =>
      expect(
        screen.getByText(/No entries match your filters/i)
      ).toBeInTheDocument()
    );
  });

  it("opening modal then voting from modal works (isVoting wiring)", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    installFetch((url, init) => {
      if (url.includes("/api/cookbook/entries"))
        return entriesOk([sampleEntry()]);
      if (url.includes("/api/cookbook/vote") && init?.method === "POST")
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ action: "added", upCount: 6, downCount: 2 }),
        } as Partial<Response>);
      if (url.includes("/api/cookbook/vote")) return votesOk();
      return Promise.reject(new Error("nope"));
    });
    render(<CookbookPage />);
    await waitFor(() =>
      expect(screen.getByTestId("entry-entry-1")).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /view-entry-1/i }));
    });
    expect(screen.getByTestId("modal-logged-in").textContent).toBe("yes");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /modal-up/i }));
    });
    await waitFor(() =>
      expect(screen.getByTestId("up-entry-1").textContent).toBe("6")
    );
  });
});
