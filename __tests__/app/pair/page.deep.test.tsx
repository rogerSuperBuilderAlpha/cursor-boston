/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getPairProfile, getAllActiveProfiles } from "@/lib/pair-programming/data";
import { getTopMatches } from "@/lib/pair-programming/matching";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/components/NeedsWorkBanner", () => ({
  NeedsWorkBanner: () => null,
}));

jest.mock("@/lib/pair-programming/data", () => ({
  getPairProfile: jest.fn(),
  getAllActiveProfiles: jest.fn(),
  getPairSessionsForUser: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/pair-programming/matching", () => ({
  getTopMatches: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetPairProfile = getPairProfile as jest.Mock;
const mockGetAllActiveProfiles = getAllActiveProfiles as jest.Mock;
const mockGetTopMatches = getTopMatches as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;

const UID = "pair-deep-uid";
const PARTNER_UID = "partner-deep-uid";

const activeProfile = {
  userId: UID,
  skillsCanTeach: ["React"],
  skillsWantToLearn: ["Rust"],
  preferredLanguages: ["TypeScript"],
  preferredFrameworks: ["Next.js"],
  timezone: "America/New_York",
  availability: [{ dayOfWeek: 2, startTime: "14:00", endTime: "18:00" }],
  sessionTypes: ["build-together" as const],
  bio: "Pair on full-stack features.",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function installFetchMock(
  overrides: {
    requests?: unknown[];
    profilePostOk?: boolean;
  } = {},
) {
  const { requests = [], profilePostOk = true } = overrides;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/api/pair/request") && method === "GET") {
      return {
        ok: true,
        json: async () => ({ success: true, requests }),
      };
    }
    if (url.includes("/api/pair/request") && method === "POST") {
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    }
    if (url.includes("/api/pair/profile") && method === "POST") {
      return {
        ok: profilePostOk,
        json: async () =>
          profilePostOk
            ? { success: true }
            : { success: false, error: "Validation failed" },
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
}

describe("pair page deep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    const mockDoc = doc as unknown as jest.Mock;
    if (typeof mockDoc.mockImplementation === "function") {
      mockDoc.mockImplementation((_db: unknown, ...segments: string[]) => ({
        path: segments.join("/"),
      }));
    }
    mockGetDoc.mockImplementation(async (ref: { path?: string }) => {
      const path = typeof ref?.path === "string" ? ref.path : "";
      if (path === `users/${PARTNER_UID}`) {
        return {
          exists: () => true,
          data: () => ({ displayName: "Partner Dev", photoURL: null }),
        };
      }
      return { exists: () => false, data: () => undefined };
    });
    mockGetAllActiveProfiles.mockResolvedValue([
      activeProfile,
      { ...activeProfile, userId: PARTNER_UID, skillsCanTeach: ["Rust"] },
    ]);
    mockGetTopMatches.mockResolvedValue([]);
    installFetchMock();
  });

  it("renders sign-in prompt for signed-out visitors", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const Page = (await import("@/app/pair/page")).default;
    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: /Pair Programming Matchmaker/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign In/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows create-profile form when user has no pair profile", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(null);

    const Page = (await import("@/app/pair/page")).default;
    render(<Page />);

    expect(
      await screen.findByRole("heading", {
        name: /Create Your Pair Programming Profile/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/Add skill \(press Enter\)/i)[0]).toBeInTheDocument();
  });

  it("opens edit profile from the matchmaker dashboard", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(activeProfile);

    const Page = (await import("@/app/pair/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByRole("button", { name: /Edit Profile/i });
    await user.click(screen.getByRole("button", { name: /Edit Profile/i }));

    expect(
      await screen.findByRole("heading", {
        name: /Create Your Pair Programming Profile/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders match cards with scores and match reasons", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(activeProfile);
    mockGetTopMatches.mockResolvedValue([
      {
        userId: PARTNER_UID,
        score: 85,
        reasons: ["You teach React, they want to learn React"],
      },
    ]);

    const Page = (await import("@/app/pair/page")).default;
    render(<Page />);

    expect(await screen.findByText("Partner Dev")).toBeInTheDocument();
    expect(screen.getByText(/85% match/)).toBeInTheDocument();
    expect(screen.getByText(/Why you match:/i)).toBeInTheDocument();
  });

  it("shows pending requests banner when requests exist", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(activeProfile);
    installFetchMock({ requests: [{ id: "req-1" }, { id: "req-2" }] });

    const Page = (await import("@/app/pair/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/You have 2 pending request\(s\)/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View requests/i })).toHaveAttribute(
      "href",
      "/pair/requests",
    );
  });

  it("shows empty matches message when no partners found", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(activeProfile);
    mockGetTopMatches.mockResolvedValue([]);

    const Page = (await import("@/app/pair/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/No matches found yet/i),
    ).toBeInTheDocument();
  });

  it("alerts when sending a pair request without a message", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(activeProfile);
    mockGetTopMatches.mockResolvedValue([
      { userId: PARTNER_UID, score: 72, reasons: ["Timezone overlap"] },
    ]);

    const Page = (await import("@/app/pair/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText("Partner Dev");
    await user.click(screen.getByRole("button", { name: /Send Pair Request/i }));
    await user.click(screen.getByRole("button", { name: /^Send Request$/i }));

    expect(window.alert).toHaveBeenCalledWith("Please enter a message");
  });

  it("posts pair request when message is provided", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(activeProfile);
    mockGetTopMatches.mockResolvedValue([
      { userId: PARTNER_UID, score: 72, reasons: ["Timezone overlap"] },
    ]);

    const Page = (await import("@/app/pair/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText("Partner Dev");
    await user.click(screen.getByRole("button", { name: /Send Pair Request/i }));
    await user.type(
      screen.getByPlaceholderText(/Send a message/i),
      "Want to pair on auth flows Saturday afternoon.",
    );
    await user.click(screen.getByRole("button", { name: /^Send Request$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/pair/request",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(PARTNER_UID),
        }),
      );
    });
    expect(window.alert).toHaveBeenCalledWith("Pair request sent successfully!");
  });

  it("saves a new pair profile via POST /api/pair/profile", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(null);

    const Page = (await import("@/app/pair/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    expect(
      await screen.findByRole("heading", {
        name: /Create Your Pair Programming Profile/i,
      }),
    ).toBeInTheDocument();

    const teachInput = screen.getAllByPlaceholderText(/Add skill \(press Enter\)/i)[0];
    await user.type(teachInput, "React{enter}");
    await user.click(screen.getByLabelText(/build together/i));
    await user.click(screen.getByRole("button", { name: /Save Profile/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/pair/profile",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
