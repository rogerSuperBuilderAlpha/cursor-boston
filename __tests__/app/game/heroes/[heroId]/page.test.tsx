/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) =>
    require("react").createElement("div", { "data-testid": "markdown" }, children),
}));
jest.mock("remark-gfm", () => ({}));
jest.mock("rehype-sanitize", () => ({
  __esModule: true,
  default: () => () => {},
}));

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
  hasBackstory: true,
};

describe("game hero detail page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/game/heroes/hero-1") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            hero: mockHero,
            events: [
              {
                id: "evt-1",
                kind: "emerged",
                createdAt: "2026-05-01T12:00:00.000Z",
                tileId: "0_0",
                ownerIdAtTime: "u1",
                seasonNumber: 1,
              },
            ],
            nextCursor: null,
            hasMore: false,
          }),
        };
      }
      if (url === "/api/game/heroes/hero-1/backstory") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            markdown: "## Chapter 1\n\nA forge-born legend.",
          }),
        };
      }
      if (url.includes("/chapter")) {
        return {
          ok: true,
          json: async () => ({ success: true, chapters: [] }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders hero name and chronicle", async () => {
    const Page = (await import("@/app/game/heroes/[heroId]/page")).default;
    const params = Promise.resolve({ heroId: "hero-1" });
    (params as Promise<{ heroId: string }> & { __testResolvedValue: { heroId: string } }).__testResolvedValue = {
      heroId: "hero-1",
    };
    const { getByText } = render(<Page params={params} />);
    await waitFor(() => {
      expect(getByText("Valdris")).toBeInTheDocument();
      expect(getByText(/Chronicle/i)).toBeInTheDocument();
      expect(getByText(/forge-born legend/i)).toBeInTheDocument();
    });
  });
});
