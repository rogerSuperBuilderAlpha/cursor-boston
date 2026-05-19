/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

const mockUseAuth = useAuth as jest.Mock;

describe("game armageddon page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/game/armageddon") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            history: [
              {
                seasonNumber: 1,
                triggeredAt: new Date("2026-05-01T00:00:00.000Z"),
                triggeredBy: { userId: "u2", displayName: "Sealbreaker", caste: "red" },
                totalParticipants: 1,
                totalTickets: 10,
                seals: [],
                winners: [
                  {
                    rank: 1,
                    userId: "u2",
                    displayName: "Sealbreaker",
                    caste: "red",
                    tickets: 10,
                  },
                ],
                topByTilesSnapshot: [],
              },
            ],
          }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              caste: "red",
              phase: "play",
              turnsRemaining: 150,
              stats: { ...BASE_PLAYER.stats, tilesHeld: 10000 },
            },
            tiles: [
              { tileId: "m1", ownerId: "u1", type: "magic", units: { ground: 0, siege: 0, air: 0 } },
            ],
          }),
        };
      }
      if (url === "/api/game/world-meta") {
        return {
          ok: true,
          json: async () => ({ success: true, worldMeta: { sealsBroken: 2 } }),
        };
      }
      if (url.startsWith("/api/game/prophecies")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            prophecies: [
              {
                id: "p1",
                authorId: "u3",
                authorDisplayName: "Seer",
                prediction: "The red kingdom will crack the sky.",
              },
            ],
          }),
        };
      }
      if (url === "/api/game/spell/armageddon" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            sealBroken: true,
            successChance: 0.5,
            sealsBroken: 3,
            shouldTriggerResolve: false,
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders history, prophecies, and casts armageddon", async () => {
    const Page = (await import("@/app/game/armageddon/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getAllByText(/Sealbreaker/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Prophecies for Seal/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Cast Armageddon/i }));

    await waitFor(() => {
      expect(screen.getByText(/A Seal cracks/i)).toBeInTheDocument();
    });
  });
});
