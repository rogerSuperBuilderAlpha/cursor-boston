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
    type: "magic" as const,
    ownerId: "u1",
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  },
];

describe("game spells page", () => {
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
              caste: "red",
              phase: "play",
              productionSpellsActive: [],
            },
            tiles: mockTiles,
          }),
        };
      }
      if (url.startsWith("/api/game/map/me")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            myTiles: mockTiles,
            borderTiles: [],
            owners: [],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders spell book heading", async () => {
    const Page = (await import("@/app/game/spells/page")).default;
    const { getByText } = render(<Page />);
    await waitFor(() => {
      expect(getByText(/red spell book/i)).toBeInTheDocument();
    });
  });
});
