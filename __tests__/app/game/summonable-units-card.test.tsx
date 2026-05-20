/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/SummonableUnitsCard.tsx`
 * was at 40% statements (27 uncovered). Covers null-pool render, signed-out
 * no-op, summary count display, summon happy path, unsummon happy path,
 * empty-tile-id guard, callApi error branches (success:false, fetch
 * throw, non-Error throw).
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/game/content/special-units/_index", () => ({
  SPECIAL_UNITS_BY_ID: new Map([
    [
      "elf-archer",
      { id: "elf-archer", name: "Elf Archer", attackBonus: 5, defenseBonus: 2, flavor: "Sharp eyes." },
    ],
  ]),
}));

import { useAuth } from "@/contexts/AuthContext";
import { SummonableUnitsCard } from "@/app/game/_components/dashboard/SummonableUnitsCard";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const originalFetch = global.fetch;

function setUser(user: unknown) {
  mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false } as never);
}

function makePlayer(units: Array<{ instanceId: string; defId: string; stationedTileId?: string }>) {
  return { userId: "u1", summonableSpecialUnits: units } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("SummonableUnitsCard", () => {
  it("renders null when the pool is empty", () => {
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    const { container } = render(
      <SummonableUnitsCard
        player={{ userId: "u1", summonableSpecialUnits: [] } as never}
        onRefresh={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when summonableSpecialUnits is missing", () => {
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    const { container } = render(
      <SummonableUnitsCard
        player={{ userId: "u1" } as never}
        onRefresh={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays summary counts (stationed + unstationed)", () => {
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([
          { instanceId: "i1", defId: "elf-archer", stationedTileId: "q5-3" },
          { instanceId: "i2", defId: "elf-archer" },
          { instanceId: "i3", defId: "elf-archer" },
        ])}
        onRefresh={jest.fn()}
      />
    );
    expect(screen.getByText(/2 ready · 1 stationed/)).toBeInTheDocument();
    expect(screen.getAllByText(/Elf Archer/).length).toBe(3);
    expect(screen.getAllByText(/Sharp eyes\./).length).toBe(3);
  });

  it("falls back to defId when SPECIAL_UNITS_BY_ID has no entry", () => {
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "unknown-unit" }])}
        onRefresh={jest.fn()}
      />
    );
    expect(screen.getByText("unknown-unit")).toBeInTheDocument();
    expect(screen.getByText(/\+0 atk · \+0 def/)).toBeInTheDocument();
  });

  it("Summon button is a no-op when tile id is empty (sets error)", () => {
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer" }])}
        onRefresh={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Summon/i }));
    expect(screen.getByText(/Enter a tile id first/i)).toBeInTheDocument();
  });

  it("Summon happy path: POST + onRefresh called", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as never;
    const onRefresh = jest.fn();
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer" }])}
        onRefresh={onRefresh}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/tile id/i), {
      target: { value: "q5-3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Summon/i }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());

    const args = (global.fetch as jest.Mock).mock.calls[0];
    expect(args[0]).toBe("/api/game/special-units/summon");
    const body = JSON.parse(args[1].body);
    expect(body).toEqual({ instanceId: "i1", targetTileId: "q5-3" });
  });

  it("Recall (unsummon) happy path: POST + onRefresh called", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as never;
    const onRefresh = jest.fn();
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer", stationedTileId: "q5-3" }])}
        onRefresh={onRefresh}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Recall/i }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    const args = (global.fetch as jest.Mock).mock.calls[0];
    expect(args[0]).toBe("/api/game/special-units/unsummon");
  });

  it("surfaces data.error.message on success:false", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, error: { message: "tile taken" } }),
    })) as never;
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer" }])}
        onRefresh={jest.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/tile id/i), {
      target: { value: "q5-3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Summon/i }));
    await waitFor(() => expect(screen.getByText(/tile taken/i)).toBeInTheDocument());
  });

  it("falls back to 'Action failed' when error body has no detail", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: false }),
    })) as never;
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer", stationedTileId: "q5-3" }])}
        onRefresh={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Recall/i }));
    await waitFor(() => expect(screen.getByText(/Action failed/i)).toBeInTheDocument());
  });

  it("surfaces fetch throw with Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer", stationedTileId: "q5-3" }])}
        onRefresh={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Recall/i }));
    await waitFor(() => expect(screen.getByText(/network down/i)).toBeInTheDocument());
  });

  it("falls back to 'Failed' on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "string-error";
    }) as never;
    setUser({ uid: "u1", getIdToken: async () => "tok" });
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer", stationedTileId: "q5-3" }])}
        onRefresh={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Recall/i }));
    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
  });

  it("no-op (no fetch) when user is signed out", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as never;
    setUser(null);
    render(
      <SummonableUnitsCard
        player={makePlayer([{ instanceId: "i1", defId: "elf-archer", stationedTileId: "q5-3" }])}
        onRefresh={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Recall/i }));
    await new Promise((r) => setTimeout(r, 20));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
