/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityPanel } from "@/app/game/_components/dashboard/CommunityPanel";

jest.mock("@/app/game/_components/dashboard/ReactionsRow", () => ({
  ReactionsRow: () => null,
}));

const mockUser = {
  uid: "u1",
  getIdToken: jest.fn().mockResolvedValue("token-u1"),
};

describe("CommunityPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("renders collapsed by default without fetching", () => {
    render(<CommunityPanel user={mockUser as never} isAdmin={false} myCaste="red" />);

    expect(screen.getByText(/Community/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("loads feed and chat when expanded", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/api/game/community/feed")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            events: [
              {
                id: "e1",
                kind: "caste_pick",
                actorUserId: "u2",
                actorDisplayName: "Alice",
                actorCaste: "red",
                createdAt: Date.now(),
              },
            ],
          }),
        };
      }
      if (url.includes("/api/game/community/chat")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            messages: [
              {
                id: "m1",
                body: "Hello kingdom",
                authorId: "u2",
                authorName: "Bob",
                createdAt: Date.now(),
                scope: "global",
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({ success: false }) };
    });

    const user = userEvent.setup();
    render(<CommunityPanel user={mockUser as never} isAdmin={false} myCaste="red" />);

    await user.click(screen.getByRole("button", { name: /Community/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/community/feed",
        expect.any(Object)
      );
    });
    expect(await screen.findByText(/Hello kingdom/i)).toBeInTheDocument();
    expect(await screen.findByText(/1 event/i)).toBeInTheDocument();
    expect(await screen.findByText(/chose/i)).toBeInTheDocument();
  });

  it("shows error when feed load fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: { message: "Feed unavailable" },
      }),
    });

    const user = userEvent.setup();
    render(<CommunityPanel user={mockUser as never} isAdmin={false} myCaste={null} />);

    await user.click(screen.getByRole("button", { name: /Community/i }));

    expect(await screen.findByText(/Feed unavailable/i)).toBeInTheDocument();
  });
});
