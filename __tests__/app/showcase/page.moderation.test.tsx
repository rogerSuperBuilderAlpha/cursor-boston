/* eslint-disable @next/next/no-img-element */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as AuthContext from "@/contexts/AuthContext";
import ShowcasePage from "@/app/showcase/page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock("@/content/showcase.json", () => ({
  projects: [
    {
      id: "project-1",
      name: "Project One",
      description: "A project",
      image: "/showcase/project-1.png",
      categories: ["AI"],
      contact: {},
      submittedBy: "Member",
      submittedDate: "2026-03-10",
    },
  ],
}));

jest.mock("firebase/auth", () => ({
  getIdToken: jest.fn(async () => "test-token"),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

type PendingSubmission = {
  submissionId: string;
  userId: string;
  projectId: string;
  createdAt?: string;
  resubmittedAt?: string;
};

type TalkSubmission = {
  submissionId: string;
  userId: string;
  title: string;
  status: "pending" | "approved" | "completed" | "unknown";
  createdAt?: string;
};

const mockUser = {
  uid: "user-1",
  email: "member@example.com",
  displayName: "Member",
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function setupFetch(options?: {
  admin?: boolean;
  pendingSubmissions?: PendingSubmission[];
  talkSubmissions?: TalkSubmission[];
}) {
  const {
    admin = false,
    pendingSubmissions = [],
    talkSubmissions = [],
  } = options || {};

  const fetchMock = jest.fn((input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/api/showcase/vote") && method === "GET") {
      return jsonResponse({ votes: {}, userVotes: {} });
    }

    if (url.includes("/api/showcase/submission") && !url.includes("/approve") && method === "GET") {
      return jsonResponse({ submissions: [] });
    }

    if (url.includes("/api/showcase/submission/approve") && method === "GET") {
      return admin
        ? jsonResponse({ pendingSubmissions })
        : jsonResponse({ error: "Forbidden" }, 403);
    }

    if (url.includes("/api/talks/submission/moderate") && method === "GET") {
      return admin
        ? jsonResponse({ talkSubmissions })
        : jsonResponse({ error: "Forbidden" }, 403);
    }

    if (url.includes("/api/showcase/submission/approve") && method === "POST") {
      return jsonResponse({ approved: true, status: "approved" });
    }

    if (url.includes("/api/talks/submission/moderate") && method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return jsonResponse({
        approved: true,
        status: body.action === "complete" ? "completed" : "approved",
      });
    }

    return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
  });

  global.fetch = fetchMock as jest.Mock;
  return fetchMock;
}

describe("ShowcasePage moderation controls", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does not render moderation controls for non-admin users", async () => {
    setupFetch({ admin: false });

    render(<ShowcasePage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/showcase/submission/approve",
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    expect(screen.queryByText("Submission Moderation")).not.toBeInTheDocument();
  });

  it("renders moderation controls for admins", async () => {
    setupFetch({
      admin: true,
      pendingSubmissions: [{ submissionId: "s1", userId: "u1", projectId: "project-1" }],
      talkSubmissions: [{ submissionId: "t1", userId: "u2", title: "Talk A", status: "pending" }],
    });

    render(<ShowcasePage />);

    await waitFor(() => {
      expect(screen.getByText("Submission Moderation")).toBeInTheDocument();
    });

    expect(screen.getByText("Talk Moderation")).toBeInTheDocument();
  });

  it("renders strict status-based talk moderation actions", async () => {
    setupFetch({
      admin: true,
      pendingSubmissions: [],
      talkSubmissions: [
        { submissionId: "t-p", userId: "u1", title: "Pending Talk", status: "pending" },
        { submissionId: "t-a", userId: "u2", title: "Approved Talk", status: "approved" },
        { submissionId: "t-c", userId: "u3", title: "Completed Talk", status: "completed" },
        { submissionId: "t-u", userId: "u4", title: "Unknown Talk", status: "unknown" },
      ],
    });

    render(<ShowcasePage />);

    await waitFor(() => {
      expect(screen.getByText("Talk Moderation")).toBeInTheDocument();
    });

    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Mark Delivered" })).toHaveLength(1);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("No action")).toBeInTheDocument();
  });

  it("wires showcase and talk moderation button actions to expected endpoints", async () => {
    const fetchMock = setupFetch({
      admin: true,
      pendingSubmissions: [{ submissionId: "s-approve", userId: "u1", projectId: "project-1" }],
      talkSubmissions: [{
        submissionId: "t-complete",
        userId: "u2",
        title: "Approved Talk",
        status: "approved",
      }],
    });

    const user = userEvent.setup();
    render(<ShowcasePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mark Delivered" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Mark Delivered" }));

    await waitFor(() => {
      expect(screen.getByText("Talk marked as delivered.")).toBeInTheDocument();
    });

    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init?.method || "GET") === "POST");

    const showcasePostCall = postCalls.find(([url]) =>
      String(url).includes("/api/showcase/submission/approve")
    );
    expect(showcasePostCall).toBeDefined();
    expect(JSON.parse(String(showcasePostCall?.[1]?.body))).toEqual(
      expect.objectContaining({ submissionId: "s-approve", action: "approve" })
    );

    const talkPostCall = postCalls.find(([url]) =>
      String(url).includes("/api/talks/submission/moderate")
    );
    expect(talkPostCall).toBeDefined();
    expect(JSON.parse(String(talkPostCall?.[1]?.body))).toEqual(
      expect.objectContaining({ submissionId: "t-complete", action: "complete" })
    );
  });
});
