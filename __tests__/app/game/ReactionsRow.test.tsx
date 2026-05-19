/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactionsRow } from "@/app/game/_components/dashboard/ReactionsRow";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

describe("ReactionsRow", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        active: true,
        reactions: { "⚔️": 2 },
      }),
    }) as typeof fetch;
  });

  it("optimistically toggles and reconciles a reaction", async () => {
    render(
      <ReactionsRow
        user={makeAuthUser("u1")}
        scope="feed"
        docId="event-1"
        initialReactions={{ "⚔️": 1 }}
        initialActive={new Set()}
      />,
    );

    const attackButton = screen.getAllByRole("button")[0];
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/reactions",
        expect.objectContaining({ method: "PUT" }),
      );
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("rolls back and surfaces server errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: { message: "reaction blocked" } }),
    });

    render(
      <ReactionsRow
        user={makeAuthUser("u1")}
        scope="hero_event"
        heroId="hero-1"
        docId="event-1"
        initialReactions={{ "⚔️": 1 }}
        initialActive={new Set(["hero_event|event-1|0"])}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/reaction blocked/i);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders nothing for signed-out users", () => {
    const { container } = render(
      <ReactionsRow user={null} scope="chat" docId="msg-1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
