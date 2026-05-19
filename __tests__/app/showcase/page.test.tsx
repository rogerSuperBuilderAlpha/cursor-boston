/* eslint-disable @next/next/no-img-element -- next/image mocked as img for RTL */
/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock("@/content/showcase.json", () => ({
  projects: [
    {
      id: "proj-1",
      name: "Community Build",
      description: "Shipped with Cursor",
      image: "/showcase/proj-1.png",
      categories: ["Tools"],
      contact: { github: "https://github.com/example/repo" },
      submittedBy: "Builder",
      submittedDate: "2026-04-01",
    },
    {
      id: "proj-2",
      name: "Second Project",
      description: "Another build",
      image: "/showcase/proj-2.png",
      categories: ["Community"],
      contact: { github: "https://github.com/example/repo-2" },
      submittedBy: "Other",
      submittedDate: "2026-04-02",
    },
    {
      id: "proj-3",
      name: "Fresh Project",
      description: "Not yet submitted",
      image: "/showcase/proj-3.png",
      categories: ["Tools"],
      contact: { github: "https://github.com/example/repo-3" },
      submittedBy: "Newcomer",
      submittedDate: "2026-04-03",
    },
  ],
}));

const mockUseAuth = useAuth as jest.Mock;

function setupShowcaseFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    if (url.includes("/api/showcase/vote") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          votes: { "proj-1": { upCount: 5, downCount: 1 } },
          userVotes: { "proj-1": "up" },
        }),
      };
    }
    if (url.includes("/api/showcase/vote") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        projectId: string;
        type: string;
      };
      if (body.type === "down") {
        return {
          ok: true,
          json: async () => ({
            action: "set",
            upCount: 5,
            downCount: 2,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          action: "removed",
          upCount: 4,
          downCount: 1,
        }),
      };
    }
    if (url.includes("/api/showcase/submission") && method === "POST") {
      return {
        ok: true,
        json: async () => ({ created: true, status: "pending" }),
      };
    }
    if (url.includes("/api/showcase/submission") && !url.includes("approve")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          submissions: [
            { projectId: "proj-1", status: "approved" },
            { projectId: "proj-2", status: "pending" },
          ],
          pending: [{ projectId: "proj-2", status: "pending" }],
        }),
      };
    }
    if (url.includes("/api/showcase/submission/approve")) {
      return { ok: false, status: 403, json: async () => ({ error: "Forbidden" }) };
    }
    if (url.includes("/api/talks/submission/moderate")) {
      return { ok: false, status: 403, json: async () => ({ error: "Forbidden" }) };
    }
    return { ok: true, json: async () => ({ success: true }) };
  }) as typeof fetch;
}

describe("showcase page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      loading: false,
    });
    setupShowcaseFetch();
  });

  it("loads votes and submission state for signed-in members", async () => {
    const Page = (await import("@/app/showcase/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText("Community Build")).toBeInTheDocument();
      expect(screen.getAllByTitle("Upvote").length).toBeGreaterThan(0);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/showcase/vote",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/showcase/submission",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
    expect(screen.queryByText("Submission Moderation")).not.toBeInTheDocument();
  });

  it("posts votes and reflects submission statuses from the list", async () => {
    const user = userEvent.setup();
    const Page = (await import("@/app/showcase/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Community Build")).toBeInTheDocument();
      expect(screen.getByText("Second Project")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Submission Approved")).toBeInTheDocument();
      expect(screen.getByText("Pending Review")).toBeInTheDocument();
    });

    const downvoteButtons = screen.getAllByTitle("Downvote");
    await user.click(downvoteButtons[0]!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/showcase/vote",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ projectId: "proj-1", type: "down" }),
        }),
      );
    });

    const submitBtn = screen.getByRole("button", { name: /submit for review/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/showcase/submission",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ projectId: "proj-3" }),
        }),
      );
    });
  });

  it("shows admin moderation and approves pending showcase submissions", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/api/showcase/vote")) {
        return {
          ok: true,
          json: async () => ({ votes: {}, userVotes: {} }),
        };
      }
      if (url.includes("/api/showcase/submission/approve") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            pendingSubmissions: [
              {
                submissionId: "sub-1",
                userId: "user-9",
                projectId: "proj-2",
                createdAt: "2026-04-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url.includes("/api/showcase/submission/approve") && method === "POST") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/api/talks/submission/moderate") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            talkSubmissions: [
              {
                submissionId: "talk-1",
                userId: "speaker-1",
                title: "Cursor Tips",
                status: "pending",
                createdAt: "2026-04-02T00:00:00.000Z",
              },
              {
                submissionId: "talk-2",
                userId: "speaker-2",
                title: "Ship Faster",
                status: "approved",
                createdAt: "2026-04-03T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url.includes("/api/talks/submission/moderate") && method === "POST") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes("/api/showcase/submission") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            submissions: [{ projectId: "proj-1", status: "approved" }],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;

    const Page = (await import("@/app/showcase/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Submission Moderation")).toBeInTheDocument();
      expect(screen.getByText("Cursor Tips")).toBeInTheDocument();
    });

    await user.click(
      screen.getAllByRole("button", { name: /^Approve$/i }).find((btn) =>
        btn.closest(".rounded-lg")?.textContent?.includes("proj-2"),
      )!,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/showcase/submission/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ submissionId: "sub-1", action: "approve" }),
        }),
      );
      expect(screen.getByText(/Submission approved/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Mark Delivered/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/talks/submission/moderate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ submissionId: "talk-2", action: "complete" }),
        }),
      );
      expect(screen.getByText(/Talk marked as delivered/i)).toBeInTheDocument();
    });
  });

  it("loads more pending talks when the admin queue is capped", async () => {
    const user = userEvent.setup();
    const pendingBatch = Array.from({ length: 100 }, (_, i) => ({
      submissionId: `talk-p-${i}`,
      userId: `u-${i}`,
      title: `Pending talk ${i}`,
      status: "pending" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
    }));

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/api/showcase/vote")) {
        return { ok: true, json: async () => ({ votes: {}, userVotes: {} }) };
      }
      if (url.includes("/api/showcase/submission/approve")) {
        return {
          ok: true,
          json: async () => ({ pendingSubmissions: [] }),
        };
      }
      if (url.includes("/api/talks/submission/moderate") && method === "GET") {
        if (url.includes("cursor=talk-p-99")) {
          return {
            ok: true,
            json: async () => ({
              talkSubmissions: [
                {
                  submissionId: "talk-p-100",
                  userId: "u-100",
                  title: "Overflow talk",
                  status: "pending",
                },
              ],
              nextCursor: null,
              hasMore: false,
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ talkSubmissions: pendingBatch }),
        };
      }
      if (url.includes("/api/showcase/submission")) {
        return { ok: true, json: async () => ({ submissions: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const Page = (await import("@/app/showcase/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Load more pending/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Load more pending/i }));

    await waitFor(() => {
      expect(screen.getByText("Overflow talk")).toBeInTheDocument();
    });
  });
});
