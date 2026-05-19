/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

const queuedOrder = {
  id: "order-1",
  playerId: "u1",
  kind: "recruit_on_tile",
  params: { kind: "recruit_on_tile", tileId: "0_0", unitType: "ground" },
  sequenceIndex: 0,
  status: "queued",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("game orders page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/game/orders") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.startsWith("/api/game/orders") && init?.method === "DELETE") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.startsWith("/api/game/orders")) {
        return {
          ok: true,
          json: async () => ({ success: true, orders: [queuedOrder] }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders queued orders and posts a new order", async () => {
    const Page = (await import("@/app/game/orders/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /^Queued orders$/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/recruit_on_tile/i).length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByPlaceholderText(/tileId/i), "1_0");
    await userEvent.click(screen.getByRole("button", { name: /Enqueue/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/orders",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
