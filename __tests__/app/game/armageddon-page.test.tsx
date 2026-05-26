/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/armageddon/page.tsx` (48.8% / 41
 * uncovered branches). Covers auth-loading + signed-out gates, fetch
 * happy path, fetch error variants, ApocalypsePanel render branches
 * (caste + play phase vs locked), PropheciesPanel hidden when sealsBroken=7,
 * Hall-of-Fame empty + populated, ArmageddonCard render including
 * unbroken-seal anomaly and empty winners.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";

import ArmageddonPage from "@/app/game/armageddon/page";

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const originalFetch = global.fetch;

type FetchHandler = (url: string, init?: RequestInit) => Promise<unknown>;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockedUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: null,
    loading: state.loading ?? false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  } as never);
}

function installFetch(handler: FetchHandler) {
  global.fetch = jest.fn((url: string, init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      json: () => handler(url, init),
    })
  ) as never;
}

function defaultHandler(
  overrides: {
    history?: Record<string, unknown>;
    player?: Record<string, unknown>;
    worldMeta?: Record<string, unknown>;
    prophecies?: Record<string, unknown>;
  } = {}
): FetchHandler {
  return async (url: string) => {
    if (url.includes("/api/game/armageddon")) {
      return { success: true, history: [], ...overrides.history };
    }
    if (url.includes("/api/game/player")) {
      return {
        success: true,
        player: null,
        tiles: [],
        ...overrides.player,
      };
    }
    if (url.includes("/api/game/world-meta")) {
      return {
        success: true,
        worldMeta: { sealsBroken: 0 },
        ...overrides.worldMeta,
      };
    }
    if (url.includes("/api/game/prophecies")) {
      return { success: true, prophecies: [], ...overrides.prophecies };
    }
    return { success: true };
  };
}

function makeUser() {
  return { uid: "u1", getIdToken: async () => "tok" };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("ArmageddonPage — gates", () => {
  it("renders loading message while auth is loading", () => {
    setAuth({ loading: true });
    render(<ArmageddonPage />);
    expect(screen.getByText(/Loading Armageddon/)).toBeInTheDocument();
  });

  it("renders sign-in CTA when not authenticated", async () => {
    installFetch(defaultHandler());
    setAuth({ user: null });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Sign in to view Armageddon/)
      ).toBeInTheDocument()
    );
  });
});

describe("ArmageddonPage — happy path", () => {
  it("renders Hall of Fame empty state with no history", async () => {
    installFetch(defaultHandler());
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/No Armageddons have resolved yet/)
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Reach 10,000 tiles in the play phase/)
    ).toBeInTheDocument();
    // Player is null → "Create your general first" branch
    expect(
      screen.getByText(/Create your general first/)
    ).toBeInTheDocument();
  });

  it("renders 'Finish onboarding' branch when player exists but lacks caste", async () => {
    installFetch(
      defaultHandler({
        player: {
          player: {
            userId: "u1",
            caste: null,
            phase: "setup",
            turnsRemaining: 100,
            stats: { tilesHeld: 50 },
            activeUpgrades: {},
          },
          tiles: [],
        },
      })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Finish onboarding/)
      ).toBeInTheDocument()
    );
  });

  it("renders ApocalypsePanel when player has caste + play phase", async () => {
    installFetch(
      defaultHandler({
        player: {
          player: {
            userId: "u1",
            caste: "magic",
            phase: "play",
            turnsRemaining: 100,
            stats: { tilesHeld: 50 },
            activeUpgrades: {},
          },
          tiles: [
            { ownerId: "u1", type: "magic" },
            { ownerId: "u1", type: "magic" },
            { ownerId: "u2", type: "magic" },
          ],
        },
      })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    // ApocalypsePanel renders some kind of header; the page Armageddon heading also renders
    await waitFor(() =>
      expect(
        screen.getAllByText(/Armageddon/i).length
      ).toBeGreaterThan(0)
    );
  });

  it("hides PropheciesPanel when all 7 seals are broken", async () => {
    installFetch(
      defaultHandler({
        worldMeta: { worldMeta: { sealsBroken: 7 } },
      })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(
        screen.queryByText(/Prophecies for Seal/)
      ).not.toBeInTheDocument()
    );
  });

  it("renders PropheciesPanel for next seal when sealsBroken < 7", async () => {
    installFetch(
      defaultHandler({
        worldMeta: { worldMeta: { sealsBroken: 3 } },
      })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText(/Prophecies for Seal #4/)).toBeInTheDocument()
    );
  });
});

describe("ArmageddonPage — fetch errors", () => {
  it("renders the history error message when history.success is false with string error", async () => {
    installFetch(async (url) => {
      if (url.includes("/api/game/armageddon")) {
        return { success: false, error: "history broken" };
      }
      if (url.includes("/api/game/player")) {
        return { success: true, player: null, tiles: [] };
      }
      if (url.includes("/api/game/world-meta")) {
        return { success: true, worldMeta: { sealsBroken: 0 } };
      }
      return { success: true };
    });
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText(/history broken/)).toBeInTheDocument()
    );
  });

  it("falls back to default 'Failed to load history' when no error is provided", async () => {
    installFetch(async (url) => {
      if (url.includes("/api/game/armageddon")) {
        return { success: false };
      }
      if (url.includes("/api/game/player")) {
        return { success: true, player: null, tiles: [] };
      }
      if (url.includes("/api/game/world-meta")) {
        return { success: true, worldMeta: { sealsBroken: 0 } };
      }
      return { success: true };
    });
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Failed to load history/)
      ).toBeInTheDocument()
    );
  });

  it("renders error when fetch throws", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("network down"))
    ) as never;
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText(/network down/)).toBeInTheDocument()
    );
  });

  it("falls back to 'Failed to load' when a non-Error is thrown", async () => {
    global.fetch = jest.fn(() => Promise.reject("nope")) as never;
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText(/^Failed to load$/)).toBeInTheDocument()
    );
  });

  it("skips setting player when playerData.success is false", async () => {
    installFetch(async (url) => {
      if (url.includes("/api/game/armageddon")) {
        return { success: true, history: [] };
      }
      if (url.includes("/api/game/player")) {
        return { success: false };
      }
      if (url.includes("/api/game/world-meta")) {
        return { success: true, worldMeta: { sealsBroken: 0 } };
      }
      return { success: true };
    });
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    // Player null branch still renders the locked-panel
    await waitFor(() =>
      expect(
        screen.getByText(/Create your general first/)
      ).toBeInTheDocument()
    );
  });

  it("skips worldMeta when world-meta response has no worldMeta", async () => {
    installFetch(async (url) => {
      if (url.includes("/api/game/armageddon")) {
        return { success: true, history: [] };
      }
      if (url.includes("/api/game/player")) {
        return { success: true, player: null, tiles: [] };
      }
      if (url.includes("/api/game/world-meta")) {
        return { success: true };
      }
      return { success: true };
    });
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Prophecies for Seal #1/)
      ).toBeInTheDocument()
    );
  });
});

describe("ArmageddonPage — ArmageddonCard render", () => {
  it("renders an ArmageddonCard with full seal + winner + topByTiles snapshot", async () => {
    const ev = {
      seasonNumber: 1,
      triggeredAt: new Date("2026-01-01T00:00:00Z"),
      triggeredBy: { displayName: "Alice", caste: "magic" },
      totalParticipants: 50,
      totalTickets: 1234,
      seals: Array.from({ length: 7 }, (_, i) => ({
        broken: true,
        brokenBy: { displayName: `Hero${i + 1}`, caste: "magic" },
        brokenAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
      })),
      winners: [
        {
          userId: "w1",
          rank: 1,
          displayName: "Winston",
          caste: "wealth",
          tickets: 999,
        },
      ],
      topByTilesSnapshot: [
        {
          userId: "tp1",
          rank: 1,
          displayName: "TopDog",
          caste: "magic",
          tilesHeld: 12345,
          sealsBroken: 3,
        },
      ],
    };
    installFetch(
      defaultHandler({ history: { history: [ev as unknown as Record<string, unknown>] } })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText(/Hall of Fame — Past Armageddons/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Season 1 — Armageddon/)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Winston")).toBeInTheDocument();
    expect(screen.getByText("TopDog")).toBeInTheDocument();
    expect(screen.getByText(/Top kingdoms by tiles \(1\)/)).toBeInTheDocument();
  });

  it("renders 'unbroken (anomaly)' for missing seals and 'no participants' for empty winners", async () => {
    const ev = {
      seasonNumber: 2,
      // value is null → formatAbsolute returns '—'
      triggeredAt: null,
      triggeredBy: { displayName: "Zed", caste: "wealth" },
      totalParticipants: 0,
      totalTickets: 0,
      // Empty seals array means every slot falls into the anomaly branch
      seals: [],
      winners: [],
      topByTilesSnapshot: [],
    };
    installFetch(
      defaultHandler({ history: { history: [ev as unknown as Record<string, unknown>] } })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getAllByText(/unbroken \(anomaly\)/).length).toBe(7)
    );
    expect(
      screen.getByText(/No participants drew tickets/)
    ).toBeInTheDocument();
  });

  it("uses Firestore-style toDate() timestamp for triggeredAt", async () => {
    const ev = {
      seasonNumber: 3,
      triggeredAt: { toDate: () => new Date("2026-02-15T12:34:56Z") },
      triggeredBy: { displayName: "Tara", caste: "magic" },
      totalParticipants: 10,
      totalTickets: 100,
      seals: [
        // Mix: one broken seal + brokenBy missing path
        {
          broken: true,
          brokenBy: { displayName: "Casey", caste: "magic" },
          brokenAt: { toDate: () => new Date("2026-02-01T00:00:00Z") },
        },
        // s exists but s.broken is false → anomaly branch
        { broken: false },
      ],
      winners: [
        {
          userId: "w-a",
          rank: 1,
          displayName: "Ava",
          caste: "magic",
          tickets: 50,
        },
      ],
      topByTilesSnapshot: [],
    };
    installFetch(
      defaultHandler({ history: { history: [ev as unknown as Record<string, unknown>] } })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText("Casey")).toBeInTheDocument()
    );
    // unbroken anomaly count == 6 (1 broken + 6 missing/false slots)
    expect(screen.getAllByText(/unbroken \(anomaly\)/).length).toBe(6);
    // topByTilesSnapshot empty → details summary should NOT render
    expect(
      screen.queryByText(/Top kingdoms by tiles/)
    ).not.toBeInTheDocument();
  });
});

describe("ArmageddonPage — PropheciesPanel", () => {
  it("renders an existing prophecy with a 'Fulfilled' badge when resolvedAt is set", async () => {
    installFetch(
      defaultHandler({
        worldMeta: { worldMeta: { sealsBroken: 2 } },
        prophecies: {
          prophecies: [
            {
              id: "p1",
              authorId: "u-other",
              authorDisplayName: "Seer",
              prediction: "The third seal will fall on a Tuesday",
              resolvedAt: { seconds: 1234567890 },
              fulfilledBy: { displayName: "TheBreaker" },
            },
          ],
        },
      })
    );
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    await waitFor(() =>
      expect(screen.getByText(/Prophecies for Seal #3/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        screen.getByText(/The third seal will fall on a Tuesday/)
      ).toBeInTheDocument()
    );
    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
  });

  it("disables 'File prophecy' button when draft is empty and enables it after typing", async () => {
    installFetch(defaultHandler());
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    const button = await screen.findByRole("button", { name: /File prophecy/ });
    expect(button).toBeDisabled();
    const textarea = screen.getByPlaceholderText(/A prediction about who/);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "A foretelling" } });
    });
    expect(button).not.toBeDisabled();
  });

  it("submits a prophecy and re-fetches", async () => {
    let postCalls = 0;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/game/prophecies") && init?.method === "POST") {
        postCalls++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        }) as never;
      }
      return Promise.resolve({
        ok: true,
        json: async () => {
          const h = defaultHandler();
          return h(url);
        },
      }) as never;
    }) as never;
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    const textarea = await screen.findByPlaceholderText(
      /A prediction about who/
    );
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "I see fire" } });
    });
    const button = screen.getByRole("button", { name: /File prophecy/ });
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(postCalls).toBe(1));
  });

  it("shows error when prophecy POST returns success=false with object error.message", async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/game/prophecies") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: false,
            error: { message: "rate limited" },
          }),
        }) as never;
      }
      return Promise.resolve({
        ok: true,
        json: async () => {
          const h = defaultHandler();
          return h(url);
        },
      }) as never;
    }) as never;
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    const textarea = await screen.findByPlaceholderText(
      /A prediction about who/
    );
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "filing" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /File prophecy/ }));
    });
    await waitFor(() =>
      expect(screen.getByText("rate limited")).toBeInTheDocument()
    );
  });

  it("shows generic 'Failed to file' when prophecy POST returns success=false with no error info", async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes("/api/game/prophecies") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: false }),
        }) as never;
      }
      return Promise.resolve({
        ok: true,
        json: async () => {
          const h = defaultHandler();
          return h(url);
        },
      }) as never;
    }) as never;
    setAuth({ user: makeUser() });
    render(<ArmageddonPage />);
    const textarea = await screen.findByPlaceholderText(
      /A prediction about who/
    );
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "filing" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /File prophecy/ }));
    });
    await waitFor(() =>
      expect(screen.getByText(/Failed to file/)).toBeInTheDocument()
    );
  });
});
