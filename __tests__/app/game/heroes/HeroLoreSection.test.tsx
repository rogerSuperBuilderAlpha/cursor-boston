/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { HeroLoreSection } from "@/app/game/heroes/[heroId]/HeroLoreSection";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

describe("HeroLoreSection", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/chapter")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            chapters: [
              {
                id: "c1",
                authorId: "u1",
                authorDisplayName: "Author",
                body: "A tale of the forge.",
                status: "approved",
                createdAt: "2026-05-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url.includes("/epitaph")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            epitaphs: [
              {
                id: "e1",
                authorId: "u2",
                authorDisplayName: "Mourner",
                body: "Gone but remembered.",
                createdAt: "2026-05-02T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("loads chapters for living heroes", async () => {
    render(
      <HeroLoreSection
        user={makeAuthUser()}
        heroId="hero-1"
        isFallen={false}
        isAdmin={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/A tale of the forge/i)).toBeInTheDocument();
    });
  });

  it("loads epitaphs for fallen heroes", async () => {
    render(
      <HeroLoreSection
        user={makeAuthUser()}
        heroId="hero-1"
        isFallen
        isAdmin={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Gone but remembered/i)).toBeInTheDocument();
    });
  });
});
