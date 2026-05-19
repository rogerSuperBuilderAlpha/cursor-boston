/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

const mockUseAuth = useAuth as jest.Mock;

const mockTiles = [
  {
    tileId: "0_0",
    q: 0,
    r: 0,
    type: "unrevealed" as const,
    ownerId: "u1",
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  },
  {
    tileId: "1_0",
    q: 1,
    r: 0,
    type: "unassigned" as const,
    ownerId: "u1",
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  },
];

describe("game setup page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              phase: "explore",
              caste: null,
            },
            tiles: mockTiles,
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders setup heading and phase", async () => {
    const Page = (await import("@/app/game/setup/page")).default;
    const { getByText } = render(<Page />);
    await waitFor(() => {
      expect(getByText(/^Setup$/)).toBeInTheDocument();
      expect(getByText(/Step 1 of 3 — Explore/i)).toBeInTheDocument();
    });
  });
});
