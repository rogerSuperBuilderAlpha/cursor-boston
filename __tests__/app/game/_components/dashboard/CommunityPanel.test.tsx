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

describe("CommunityPanel (dashboard)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    global.fetch = jest.fn();
  });

  it("renders collapsed by default without fetching", () => {
    render(<CommunityPanel user={mockUser as never} isAdmin={false} myCaste="red" />);

    expect(screen.getByText(/Community — recent events/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Community — recent events/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/community/feed",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token-u1",
          }),
        }),
      );
    });
    expect(await screen.findByText(/Hello kingdom/i)).toBeInTheDocument();
    expect(screen.getByText(/chose/i)).toBeInTheDocument();
  });

  it("posts a chat message optimistically", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/game/community/feed")) {
        return {
          ok: true,
          json: async () => ({ success: true, events: [] }),
        };
      }
      if (url.includes("/api/game/community/chat") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: {
              id: "m-new",
              body: "New rally cry",
              authorId: "u1",
              authorName: "You",
              createdAt: Date.now(),
              scope: "global",
            },
          }),
        };
      }
      if (url.includes("/api/game/community/chat")) {
        return {
          ok: true,
          json: async () => ({ success: true, messages: [] }),
        };
      }
      return { ok: false, json: async () => ({ success: false }) };
    });

    const user = userEvent.setup();
    render(<CommunityPanel user={mockUser as never} isAdmin={false} myCaste="red" />);
    await user.click(screen.getByRole("button", { name: /Community — recent events/i }));

    const input = await screen.findByPlaceholderText(/Say something to the kingdom/i);
    await user.type(input, "New rally cry");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/community/chat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ body: "New rally cry" }),
        }),
      );
    });
    expect(await screen.findByText("New rally cry")).toBeInTheDocument();
  });

  it("refetches chat when switching to caste room", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/api/game/community/feed")) {
        return { ok: true, json: async () => ({ success: true, events: [] }) };
      }
      if (url.includes("scope=caste%3Ared")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            messages: [
              {
                id: "m-caste",
                body: "Red room only",
                authorId: "u2",
                authorName: "Scarlet",
                createdAt: Date.now(),
                scope: "caste:red",
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true, messages: [] }) };
    });

    const user = userEvent.setup();
    render(<CommunityPanel user={mockUser as never} isAdmin={false} myCaste="red" />);
    await user.click(screen.getByRole("button", { name: /Community — recent events/i }));
    await screen.findByRole("tab", { name: /^red$/i });
    await user.click(screen.getByRole("tab", { name: /^red$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("scope=caste%3Ared"),
        expect.any(Object),
      );
    });
    expect(await screen.findByText("Red room only")).toBeInTheDocument();
  });

  it("lets admins delete a message after confirm", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/game/community/feed")) {
        return { ok: true, json: async () => ({ success: true, events: [] }) };
      }
      if (url.includes("/api/game/community/chat/m1") && init?.method === "DELETE") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/api/game/community/chat")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            messages: [
              {
                id: "m1",
                body: "Remove me",
                authorId: "u2",
                authorName: "ModTarget",
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
    render(<CommunityPanel user={mockUser as never} isAdmin={true} myCaste="red" />);
    await user.click(screen.getByRole("button", { name: /Community — recent events/i }));
    expect(await screen.findByText("Remove me")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Delete message/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/community/chat/m1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("Remove me")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /Community — recent events/i }));

    expect(await screen.findByText(/Feed unavailable/i)).toBeInTheDocument();
  });
});
