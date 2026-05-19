/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("posts a new chapter and refreshes the list", async () => {
    const user = userEvent.setup();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/chapter") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      if (url.includes("/chapter")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            chapters: [
              {
                id: "c2",
                authorId: "u1",
                authorDisplayName: "You",
                body: "Fresh chronicle entry.",
                status: "pending",
                createdAt: { seconds: 1_700_000_000 },
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    });

    render(
      <HeroLoreSection user={makeAuthUser("u1")} heroId="hero-1" isFallen={false} isAdmin={false} />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Add a new chapter/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Add a new chapter/i), "Fresh chronicle entry.");
    await user.click(screen.getByRole("button", { name: /Submit chapter/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/game/heroes/hero-1/chapter",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText(/Fresh chronicle entry/i)).toBeInTheDocument();
      expect(screen.getByText("pending", { selector: "span.rounded-full" })).toBeInTheDocument();
    });
  });

  it("lets admins approve pending chapters", async () => {
    const user = userEvent.setup();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/chapter/") && init?.method === "PATCH") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/chapter")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            chapters: [
              {
                id: "c-pending",
                authorId: "other",
                authorDisplayName: "Scribe",
                body: "Awaiting approval.",
                status: "pending",
                createdAt: "2026-05-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    });

    render(
      <HeroLoreSection user={makeAuthUser("admin")} heroId="hero-1" isFallen={false} isAdmin />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Awaiting approval/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^Approve$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/game/heroes/hero-1/chapter/c-pending",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("posts an epitaph for fallen heroes", async () => {
    const user = userEvent.setup();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/epitaph") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/epitaph")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            epitaphs: [
              {
                id: "e2",
                authorId: "u1",
                authorDisplayName: "Mourner",
                body: "Rest well, hero.",
                createdAt: "2026-05-02T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url.includes("/chapter")) {
        return { ok: true, json: async () => ({ success: true, chapters: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    });

    render(
      <HeroLoreSection user={makeAuthUser("u1")} heroId="hero-1" isFallen isAdmin={false} />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write a short epitaph/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write a short epitaph/i), "Rest well, hero.");
    await user.click(screen.getByRole("button", { name: /Submit epitaph/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/game/heroes/hero-1/epitaph",
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText(/Rest well, hero/i)).toBeInTheDocument();
    });
  });
});
