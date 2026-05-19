/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

const mockUseAuth = useAuth as jest.Mock;

const mockHero = {
  id: "hero-1",
  name: "Valdris",
  class: "military" as const,
  specialty: "siege-master",
  caste: "red" as const,
  currentOwnerId: "u1",
  isDeceased: false,
  awaitingResurrection: false,
  emergedSeasonNumber: 1,
  currentTileId: "0_0",
  stamina: 80,
  staminaMax: 100,
  hasBackstory: false,
};

describe("game heroes page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/heroes?")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            heroes: [mockHero],
            nextCursor: null,
            hasMore: false,
          }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders heroes heading and roster", async () => {
    const Page = (await import("@/app/game/heroes/page")).default;
    const { getByText } = render(<Page />);
    await waitFor(() => {
      expect(getByText(/^Heroes$/)).toBeInTheDocument();
      expect(getByText("Valdris")).toBeInTheDocument();
    });
  });
});
