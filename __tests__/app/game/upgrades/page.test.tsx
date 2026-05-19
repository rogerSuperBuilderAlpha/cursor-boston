/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";

const mockUseAuth = useAuth as jest.Mock;

describe("game upgrades page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      loading: false,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        player: {
          ...BASE_PLAYER,
          userId: "u1",
          caste: "red",
          phase: "play",
          upgradeIds: [],
        },
      }),
    }) as typeof fetch;
  });

  it("renders upgrade catalog for signed-in player", async () => {
    const Page = (await import("@/app/game/upgrades/page")).default;
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(50);
      },
      { timeout: 4000 },
    );
  });
});
