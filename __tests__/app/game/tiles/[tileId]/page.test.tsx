/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

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

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

jest.mock("@/app/game/threats/_lib/use-attack-preview", () => ({
  useAttackPreview: () => ({ preview: null, loading: false, error: null }),
}));
jest.mock("@/app/game/threats/_components/BattleSimPanel", () => ({
  BattleSimPanel: () => null,
}));
jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => null,
}));

const mockUseAuth = useAuth as jest.Mock;

const mockTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military" as const,
  ownerId: "u1",
  units: { ground: 5, siege: 0, air: 0 },
  armedDefenseSpellId: null,
  inscription: "",
};

describe("game tile detail page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return {
          ok: true,
          json: async () => ({ success: true, tile: mockTile }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [mockTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return {
          ok: true,
          json: async () => ({ success: true, artifacts: [] }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders tile id and owner stats", async () => {
    const Page = (await import("@/app/game/tiles/[tileId]/page")).default;
    const params = Promise.resolve({ tileId: "0_0" });
    (params as Promise<{ tileId: string }> & { __testResolvedValue: { tileId: string } }).__testResolvedValue = {
      tileId: "0_0",
    };
    const { getByText } = render(<Page params={params} />);
    await waitFor(() => {
      expect(getByText("0_0")).toBeInTheDocument();
      expect(getByText("You")).toBeInTheDocument();
    });
  });
});
