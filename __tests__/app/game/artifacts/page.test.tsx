/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

const artifacts = [
  {
    id: "artifact-1",
    ownerId: "u1",
    definitionId: "common-ember-flask",
    rarity: "common",
    type: "offense",
    foundAtTurn: 3,
    foundDuringAction: "attack",
    used: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: {
      id: "common-ember-flask",
      name: "Ember Flask",
      description: "A bottle of angry sparks.",
      flavorOnFind: "The coals remember you.",
      baseStrength: 10,
    },
  },
  {
    id: "artifact-2",
    ownerId: "u1",
    definitionId: "rare-ward",
    rarity: "rare",
    type: "defense",
    foundAtTurn: 4,
    foundDuringAction: "explore",
    used: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: null,
  },
];

describe("game artifacts page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/game/artifacts")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            artifacts,
            nextCursor: null,
            hasMore: false,
          }),
        };
      }
      if (url === "/api/game/artifact/use" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders inventory groups and uses an artifact", async () => {
    const Page = (await import("@/app/game/artifacts/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Ember Flask/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Use artifact/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/artifact/use",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
