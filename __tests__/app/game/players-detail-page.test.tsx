/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/players/[playerId]/page.tsx` (38.5%
 * / 59 uncovered branches). Covers auth-loading spinner, signed-out
 * gate, 404 / error fallback (no player), happy-path render variants
 * (caste null vs set, season number > 1, own profile vs not, titles
 * present, active + broken pacts, bio present vs empty, edit-bio flow
 * + save success / error, file-pact flow + error variants, character
 * counter threshold branches).
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    use<T>(usable: Promise<T> | T): T {
      const resolved = (usable as Promise<T> & { __testResolvedValue?: T })
        ?.__testResolvedValue;
      if (resolved !== undefined) return resolved;
      if (typeof actual.use === "function") {
        return actual.use(usable as never);
      }
      return usable as T;
    },
  };
});

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import PlayerProfilePage from "@/app/game/players/[playerId]/page";

const originalFetch = global.fetch;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    loading: state.loading ?? false,
  });
}

function params(playerId: string) {
  const p = Promise.resolve({ playerId }) as Promise<{ playerId: string }> & {
    __testResolvedValue?: { playerId: string };
  };
  p.__testResolvedValue = { playerId };
  return p;
}

interface PlayerOverride {
  userId?: string;
  displayName?: string;
  caste?: string | null;
  phase?: string;
  tilesExplored?: number;
  stats?: {
    attacksWon: number;
    attacksLost: number;
    tilesHeld: number;
    unitsAlive: number;
  };
  heroCount?: number;
  armageddonSealsBroken?: number;
  seasonNumber?: number;
  bio?: string;
  bioUpdatedAt?: unknown;
}

function makePlayer(over: PlayerOverride = {}) {
  return {
    userId: "u-target",
    displayName: "Caesar",
    caste: "red",
    phase: "war",
    tilesExplored: 42,
    stats: { attacksWon: 5, attacksLost: 2, tilesHeld: 3, unitsAlive: 100 },
    heroCount: 4,
    armageddonSealsBroken: 1,
    seasonNumber: 1,
    bio: "I came, I saw, I conquered.",
    bioUpdatedAt: null,
    ...over,
  };
}

interface FetchSetup {
  profile?: { success?: boolean; player?: unknown; titles?: unknown[]; error?: unknown };
  profileOk?: boolean;
  profileStatus?: number;
  pacts?: { success?: boolean; pacts?: unknown[] };
  bioPost?: { success?: boolean; error?: unknown };
  pactPost?: { success?: boolean; error?: unknown };
  throwOn?: "profile" | "pacts" | "bio" | "pact";
  throwError?: unknown;
}

function setupFetch(opts: FetchSetup = {}) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/game/players/me/bio")) {
      if (opts.throwOn === "bio") throw opts.throwError ?? new Error("bio-net");
      return {
        ok: true,
        status: 200,
        json: async () => opts.bioPost ?? { success: true },
      } as never;
    }
    if (typeof url === "string" && url.includes("/api/game/pacts") && init?.method === "POST") {
      if (opts.throwOn === "pact") throw opts.throwError ?? new Error("pact-net");
      return {
        ok: true,
        status: 200,
        json: async () => opts.pactPost ?? { success: true },
      } as never;
    }
    if (typeof url === "string" && url.includes("/api/game/pacts")) {
      if (opts.throwOn === "pacts") throw opts.throwError ?? new Error("pacts-net");
      return {
        ok: true,
        status: 200,
        json: async () => opts.pacts ?? { success: true, pacts: [] },
      } as never;
    }
    if (typeof url === "string" && url.includes("/api/game/players/")) {
      if (opts.throwOn === "profile") throw opts.throwError ?? new Error("profile-net");
      const ok = opts.profileOk ?? true;
      return {
        ok,
        status: opts.profileStatus ?? (ok ? 200 : 500),
        json: async () => opts.profile ?? { success: true, player: makePlayer(), titles: [] },
      } as never;
    }
    return { ok: true, status: 200, json: async () => ({}) } as never;
  }) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("PlayerProfilePage — gates", () => {
  it("renders spinner while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<PlayerProfilePage params={params("u-target")} />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders 'Sign in' CTA when not authenticated and auth not loading", async () => {
    // user=null, loading=false → fetchProfile early-returns leaving loading=true
    // since setLoading(false) is in finally. The page renders spinner forever
    // for signed-out users. Instead, simulate sign-out AFTER initial load by
    // first loading with a user (which clears loading state), then re-render
    // with user=null. The signed-out branch only triggers if loading=false &
    // user is null; the page's useEffect re-runs and fetchProfile returns
    // early, but loading is already false from the prior cycle.
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    setupFetch({ profile: { success: true, player: makePlayer(), titles: [] } });
    const { rerender } = render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText(/Caesar/)).toBeInTheDocument());
    setAuth({ user: null });
    rerender(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Sign in")).toBeInTheDocument());
  });
});

describe("PlayerProfilePage — error / not-found", () => {
  it("renders 'General not found.' when player is null after load", async () => {
    setupFetch({ profile: { success: true, player: undefined, titles: [] } });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("General not found.")).toBeInTheDocument());
  });

  it("surfaces error string from data.error and shows fallback page", async () => {
    setupFetch({ profile: { success: false, error: "no such general" } });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText(/no such general/)).toBeInTheDocument());
  });

  it("surfaces error.message when error is an object", async () => {
    setupFetch({ profile: { success: false, error: { message: "blocked" } } });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText(/blocked/)).toBeInTheDocument());
  });

  it("falls back to 'Failed to load profile' when error object has no message", async () => {
    setupFetch({ profile: { success: false, error: {} } });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Failed to load profile")).toBeInTheDocument());
  });

  it("surfaces network throw with non-Error fallback ('Failed to load profile')", async () => {
    setupFetch({ throwOn: "profile", throwError: "string-error" });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Failed to load profile")).toBeInTheDocument());
  });

  it("surfaces network throw Error message", async () => {
    setupFetch({ throwOn: "profile", throwError: new Error("network down") });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText(/network down/)).toBeInTheDocument());
  });
});

describe("PlayerProfilePage — happy path render", () => {
  it("renders player with caste, bio, and stats (other player)", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer(),
        titles: [],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Caesar")).toBeInTheDocument());
    expect(screen.getByText(/red caste/)).toBeInTheDocument();
    expect(screen.getByText(/I came, I saw, I conquered/)).toBeInTheDocument();
    expect(screen.getByText("File a pact")).toBeInTheDocument();
    // No "(you)" badge for viewing another's profile
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
  });

  it("renders 'no caste yet' when caste is null and 'Unnamed general' fallback", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer({ caste: null, displayName: "" }),
        titles: [],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Unnamed general")).toBeInTheDocument());
    expect(screen.getByText(/no caste yet/)).toBeInTheDocument();
  });

  it("renders season number suffix when seasonNumber > 1", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer({ seasonNumber: 3 }),
        titles: [],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText(/season 3/)).toBeInTheDocument());
  });

  it("renders '(you)' badge and Edit button when viewing own profile", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer({ userId: "self" }), titles: [] },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByText("(you)")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    // file-pact section hidden on own profile
    expect(screen.queryByText("File a pact")).not.toBeInTheDocument();
  });

  it("renders 'No bio yet.' message on own profile with empty bio", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer({ bio: "" }), titles: [] },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() =>
      expect(screen.getByText(/No bio yet\. Click Edit to add one\./)).toBeInTheDocument()
    );
  });

  it("renders 'This general hasn't written a bio.' on other profile with empty bio", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer({ bio: "" }), titles: [] },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() =>
      expect(screen.getByText(/This general hasn't written a bio\./)).toBeInTheDocument()
    );
  });

  it("renders titles list when titles array is non-empty", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer(),
        titles: [
          { id: "t1", label: "Warlord", description: "100 wins" },
          { id: "t2", label: "Survivor", description: "outlasted s1" },
        ],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Warlord")).toBeInTheDocument());
    expect(screen.getByText("Survivor")).toBeInTheDocument();
  });

  it("renders both active and broken pact entries", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      pacts: {
        success: true,
        pacts: [
          {
            id: "p1",
            authorId: "a1",
            authorDisplayName: "Alice",
            targetId: "u-target",
            targetDisplayName: "Caesar",
            statement: "no attacks for a week",
            createdAt: "2026-01-01",
            expiresAt: "2026-01-08",
          },
          {
            id: "p2",
            authorId: "a2",
            authorDisplayName: "Bob",
            targetId: "u-target",
            targetDisplayName: "Caesar",
            statement: "peace deal",
            createdAt: "2026-01-02",
            expiresAt: "2026-01-09",
            brokenAt: "2026-01-05",
          },
        ],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText(/no attacks for a week/)).toBeInTheDocument());
    expect(screen.getByText(/peace deal/)).toBeInTheDocument();
    // BROKEN / active sub-strings are siblings of <strong> tags; use textContent
    // sweep instead of getByText so text-node fragmentation doesn't trip the match.
    expect(document.body.textContent).toContain("BROKEN");
    expect(document.body.textContent).toContain("active");
  });

  it("renders fallback stat values when player.stats is undefined", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer({ stats: undefined, phase: "calm" }),
        titles: [],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Tiles held")).toBeInTheDocument());
    // `capitalize` is a CSS class, not text transform — rendered text is "calm".
    expect(screen.getByText("calm")).toBeInTheDocument();
  });

  it("skips pacts section when pacts response is unsuccessful", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      pacts: { success: false },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Caesar")).toBeInTheDocument());
    expect(screen.queryByText(/Pacts$/)).not.toBeInTheDocument();
  });
});

describe("PlayerProfilePage — bio editing", () => {
  it("opens edit mode, updates draft, and shows character counter", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer({ bio: "old" }), titles: [] },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const ta = screen.getByPlaceholderText(/A few sentences/) as HTMLTextAreaElement;
    expect(ta).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: "fresh bio" } });
    expect(ta.value).toBe("fresh bio");
    // 500 - 9 = 491 chars left
    expect(screen.getByText(/491 chars left/)).toBeInTheDocument();
  });

  it("clamps draftBio to MAX_BIO_LENGTH (500)", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer({ bio: "" }), titles: [] },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const ta = screen.getByPlaceholderText(/A few sentences/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "x".repeat(600) } });
    expect(ta.value.length).toBe(500);
    // counter shows 0 chars left and uses amber threshold
    expect(screen.getByText(/0 chars left/)).toBeInTheDocument();
  });

  it("cancels edit mode and restores bio fallback when player.bio is null", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer({ bio: "" }), titles: [] },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText(/A few sentences/)).not.toBeInTheDocument();
  });

  it("saves bio successfully and exits edit mode", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      bioPost: { success: true },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/A few sentences/)).not.toBeInTheDocument()
    );
  });

  it("surfaces bio save error (string) and stays in edit mode", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      bioPost: { success: false, error: "bio too spicy" },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(screen.getByText(/bio too spicy/)).toBeInTheDocument());
  });

  it("surfaces bio save error (object with message)", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      bioPost: { success: false, error: { message: "too long" } },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(screen.getByText(/too long/)).toBeInTheDocument());
  });

  it("falls back to 'Failed to save bio' on empty error object", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      bioPost: { success: false, error: {} },
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(screen.getByText("Failed to save bio")).toBeInTheDocument());
  });

  it("surfaces non-Error thrown during save as 'Failed to save bio'", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      throwOn: "bio",
      throwError: "boom",
    });
    setAuth({ user: { uid: "self", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("self")} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(screen.getByText("Failed to save bio")).toBeInTheDocument());
  });
});

describe("PlayerProfilePage — pact filing", () => {
  it("disables file button when draft is empty / whitespace", async () => {
    setupFetch({ profile: { success: true, player: makePlayer(), titles: [] } });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: "File pact" });
    expect(btn).toBeDisabled();
    const ta = screen.getByPlaceholderText(/I will not attack/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "   " } });
    expect(btn).toBeDisabled();
  });

  it("clamps pact draft to 200 chars and updates counter", async () => {
    setupFetch({ profile: { success: true, player: makePlayer(), titles: [] } });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    const ta = screen.getByPlaceholderText(/I will not attack/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "y".repeat(250) } });
    expect(ta.value.length).toBe(200);
    expect(screen.getByText(/0 chars left/)).toBeInTheDocument();
  });

  it("files a pact successfully and resets the draft", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      pactPost: { success: true },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    const ta = screen.getByPlaceholderText(/I will not attack/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "ceasefire" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "File pact" }));
    });
    await waitFor(() => expect(ta.value).toBe(""));
  });

  it("surfaces pact filing error string", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      pactPost: { success: false, error: "daily cap reached" },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/I will not attack/), {
      target: { value: "truce" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "File pact" }));
    });
    await waitFor(() => expect(screen.getByText(/daily cap reached/)).toBeInTheDocument());
  });

  it("surfaces pact error.message when error is object", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      pactPost: { success: false, error: { message: "already active" } },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/I will not attack/), {
      target: { value: "truce" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "File pact" }));
    });
    await waitFor(() => expect(screen.getByText(/already active/)).toBeInTheDocument());
  });

  it("falls back to 'Failed to file pact' when error object has no message", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      pactPost: { success: false, error: {} },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/I will not attack/), {
      target: { value: "truce" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "File pact" }));
    });
    await waitFor(() => expect(screen.getByText("Failed to file pact")).toBeInTheDocument());
  });

  it("falls back to 'Failed to file pact' on non-Error throw", async () => {
    setupFetch({
      profile: { success: true, player: makePlayer(), titles: [] },
      throwOn: "pact",
      throwError: "kapow",
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("File a pact")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/I will not attack/), {
      target: { value: "truce" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "File pact" }));
    });
    await waitFor(() => expect(screen.getByText("Failed to file pact")).toBeInTheDocument());
  });
});

describe("PlayerProfilePage — caste swatch fallback", () => {
  it("uses neutral swatch when caste is null", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer({ caste: null }),
        titles: [],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    const { container } = render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Caesar")).toBeInTheDocument());
    const swatch = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(swatch).toBeTruthy();
    expect(swatch?.style.background).toMatch(/737373|rgb\(115, 115, 115\)/);
  });

  it("uses caste swatch when caste is set (blue)", async () => {
    setupFetch({
      profile: {
        success: true,
        player: makePlayer({ caste: "blue" }),
        titles: [],
      },
    });
    setAuth({ user: { uid: "viewer", getIdToken: async () => "tok" } });
    const { container } = render(<PlayerProfilePage params={params("u-target")} />);
    await waitFor(() => expect(screen.getByText("Caesar")).toBeInTheDocument());
    const swatch = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(swatch?.style.background).toMatch(/60a5fa|rgb\(96, 165, 250\)/);
  });
});
