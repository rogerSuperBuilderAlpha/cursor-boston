/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveSession, getLiveRemainingSeconds } from "@/lib/live-sessions/client";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => require("react").createElement("a", { href }, children),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/live-sessions/client", () => ({
  useLiveSession: jest.fn(),
  useLiveTimerAudioAlerts: jest.fn(() => ({
    audioEnabled: false,
    audioSupported: true,
    enableAudio: jest.fn(),
  })),
  getLiveRemainingSeconds: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseLiveSession = useLiveSession as jest.Mock;
const mockGetRemaining = getLiveRemainingSeconds as jest.Mock;

const SESSION_ID = "live-audience-1";

const liveSession = {
  id: SESSION_ID,
  status: "live" as const,
  title: "Boston Lightning Talks",
  createdAtMs: Date.now(),
  updatedAtMs: Date.now(),
  emceeUid: "emcee-1",
  emceeName: "Emcee",
  audiencePath: `/live/${SESSION_ID}`,
  emceePath: `/live/${SESSION_ID}/emcee`,
  currentSpeaker: {
    entryId: "entry-1",
    speakerName: "Alex Rivera",
    talkTitle: "Agents in production",
  },
  timer: {
    status: "running" as const,
    durationSeconds: 300,
    remainingSeconds: 45,
    startedAtMs: Date.now() - 60_000,
    pausedAtMs: null,
    warningThresholds: [60, 30],
  },
  history: [],
};

function sessionParams() {
  const params = Promise.resolve({ sessionId: SESSION_ID });
  (
    params as Promise<{ sessionId: string }> & {
      __testResolvedValue: { sessionId: string };
    }
  ).__testResolvedValue = { sessionId: SESSION_ID };
  return params;
}

describe("audience live session page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRemaining.mockReturnValue(45);
    mockUseLiveSession.mockReturnValue({
      session: liveSession,
      queue: [
        {
          id: "q1",
          sessionId: SESSION_ID,
          userId: "speaker-1",
          speakerName: "Jamie",
          speakerPhotoUrl: null,
          talkTitle: "Realtime queues",
          durationMinutes: 5,
          status: "queued",
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        },
      ],
      loading: false,
      error: null,
    });
    global.fetch = jest.fn();
  });

  it("shows sign-in prompt when signed out", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const Page = (await import("@/app/live/[sessionId]/page")).default;
    render(<Page params={sessionParams()} />);

    expect(await screen.findByText(/Sign in to add your lightning talk/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign In/i })).toHaveAttribute(
      "href",
      `/login?redirect=/live/${SESSION_ID}`,
    );
  });

  it("renders session details and queue for signed-in users", async () => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("uid-live"), loading: false });
    const Page = (await import("@/app/live/[sessionId]/page")).default;
    render(<Page params={sessionParams()} />);

    await waitFor(() => {
      expect(screen.getByText("Boston Lightning Talks")).toBeInTheDocument();
      expect(screen.getByText("Agents in production")).toBeInTheDocument();
      expect(screen.getByText("Realtime queues")).toBeInTheDocument();
    });
  });

  it("submits a queue entry and shows success", async () => {
    const user = makeAuthUser("uid-live");
    mockUseAuth.mockReturnValue({ user, loading: false });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const Page = (await import("@/app/live/[sessionId]/page")).default;
    render(<Page params={sessionParams()} />);

    const talkInput = await screen.findByLabelText(/Talk title/i);
    await userEvent.type(talkInput, "My lightning talk");
    fireEvent.click(screen.getByRole("button", { name: "5 min" }));
    fireEvent.click(screen.getByRole("button", { name: /Join Queue/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/live/${SESSION_ID}/queue`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByText(/You are in the queue/i)).toBeInTheDocument();
    });
  });

  it("surfaces queue errors from the API", async () => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("uid-live"), loading: false });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Queue is closed." }),
    });

    const Page = (await import("@/app/live/[sessionId]/page")).default;
    render(<Page params={sessionParams()} />);

    const talkInput = await screen.findByLabelText(/Talk title/i);
    await userEvent.type(talkInput, "Late entry");
    fireEvent.click(screen.getByRole("button", { name: /Join Queue/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Queue is closed.");
    });
  });

  it("shows timer warnings and enables sound cues", async () => {
    mockGetRemaining.mockImplementation((session) => {
      if (!session) return 0;
      return 25;
    });
    mockUseAuth.mockReturnValue({ user: makeAuthUser("uid-live"), loading: false });

    const Page = (await import("@/app/live/[sessionId]/page")).default;
    render(<Page params={sessionParams()} />);

    await waitFor(() => {
      expect(screen.getByText("30 second warning")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Enable Sound Cues/i }));
  });

  it("shows auth loading state", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const Page = (await import("@/app/live/[sessionId]/page")).default;
    render(<Page params={sessionParams()} />);
    expect(await screen.findByText(/Checking your sign-in status/i)).toBeInTheDocument();
  });
});
