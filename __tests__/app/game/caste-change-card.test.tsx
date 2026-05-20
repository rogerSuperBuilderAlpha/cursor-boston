/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/CasteChangeCard.tsx`
 * (19% / 17 uncovered branches). Covers ineligibility gates (phase, no
 * caste, below threshold, already used), expand/cancel, same-caste guard,
 * happy path with refresh + collapse, server error.message / string /
 * fallback, fetch throw fallback, signed-out no-op.
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/game/setup/_components/CastePickCard", () => ({
  CastePickCard: ({ caste, busy, onChoose }: { caste: string; busy: boolean; onChoose: () => void }) => (
    <button onClick={onChoose} disabled={busy} data-testid={`pick-${caste}`}>
      Pick {caste}
    </button>
  ),
}));

jest.mock("@/app/game/setup/_lib/constants", () => ({
  CASTES: ["red", "blue", "green"],
}));

import { CasteChangeCard } from "@/app/game/_components/dashboard/CasteChangeCard";

function makePlayer(over: Partial<Record<string, unknown>> = {}) {
  return {
    phase: "play",
    caste: "red",
    stats: { tilesHeld: 1500 },
    casteChangesUsed: 0,
    ...over,
  } as never;
}

const baseUser = { uid: "u1", getIdToken: async () => "tok" } as never;
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("CasteChangeCard — eligibility", () => {
  it("returns null when phase is not 'play'", () => {
    const { container } = render(
      <CasteChangeCard player={makePlayer({ phase: "setup" })} user={baseUser} onRefresh={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when caste is null", () => {
    const { container } = render(
      <CasteChangeCard player={makePlayer({ caste: null })} user={baseUser} onRefresh={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when tilesHeld is below the threshold", () => {
    const { container } = render(
      <CasteChangeCard player={makePlayer({ stats: { tilesHeld: 500 } })} user={baseUser} onRefresh={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when casteChangesUsed > 0", () => {
    const { container } = render(
      <CasteChangeCard player={makePlayer({ casteChangesUsed: 1 })} user={baseUser} onRefresh={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the unlock banner when eligible", () => {
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    expect(screen.getByText(/caste switch unlocked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch my caste/ })).toBeInTheDocument();
  });

  it("treats undefined casteChangesUsed as 0 (eligible)", () => {
    render(
      <CasteChangeCard
        player={{ phase: "play", caste: "red", stats: { tilesHeld: 1500 } } as never}
        user={baseUser}
        onRefresh={jest.fn()}
      />
    );
    expect(screen.getByText(/caste switch unlocked/i)).toBeInTheDocument();
  });
});

describe("CasteChangeCard — expand/cancel", () => {
  it("expands to show pick cards on click", () => {
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    expect(screen.getByText(/Pick the caste you want to keep forever/)).toBeInTheDocument();
    expect(screen.getByTestId("pick-blue")).toBeInTheDocument();
    expect(screen.getByTestId("pick-green")).toBeInTheDocument();
  });

  it("filters out the player's current caste from picker", () => {
    render(<CasteChangeCard player={makePlayer({ caste: "red" })} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    expect(screen.queryByTestId("pick-red")).not.toBeInTheDocument();
  });

  it("collapses when X is clicked", () => {
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    fireEvent.click(screen.getByLabelText("Cancel caste change"));
    expect(screen.queryByText(/Pick the caste/)).not.toBeInTheDocument();
  });
});

describe("CasteChangeCard — changeTo", () => {
  it("signed-out no-op: doesn't fire fetch when user is null", async () => {
    global.fetch = jest.fn() as never;
    render(<CasteChangeCard player={makePlayer()} user={null} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("happy path: fetches, refreshes, collapses on success", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as never;
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(onRefresh).toHaveBeenCalled();
    expect(screen.queryByText(/Pick the caste/)).not.toBeInTheDocument();
    // Body assertion
    const args = (global.fetch as jest.Mock).mock.calls[0];
    expect(args[0]).toBe("/api/game/caste/change");
    expect(JSON.parse(args[1].body)).toEqual({ caste: "blue" });
  });

  it("surfaces error.message on success:false with object error", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "you switched once already" } }),
    })) as never;
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(screen.getByText(/you switched once already/)).toBeInTheDocument();
  });

  it("surfaces string error on success:false with string", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: "rate-limited" }),
    })) as never;
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(screen.getByText("rate-limited")).toBeInTheDocument();
  });

  it("falls back to 'Caste change failed' when no error detail", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false }),
    })) as never;
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(screen.getByText("Caste change failed")).toBeInTheDocument();
  });

  it("surfaces fetch throw Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("falls back to 'Caste change failed' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "string-error";
    }) as never;
    render(<CasteChangeCard player={makePlayer()} user={baseUser} onRefresh={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Switch my caste/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-blue"));
    });
    expect(screen.getByText("Caste change failed")).toBeInTheDocument();
  });
});
