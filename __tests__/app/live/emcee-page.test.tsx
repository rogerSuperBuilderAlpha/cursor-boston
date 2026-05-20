/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/live/[sessionId]/emcee/page.tsx`
 * (41.1% / 53 uncovered branches). Covers auth-loading + signed-out
 * gates, session-not-found 404 with and without error message,
 * read-only viewer (non-emcee) gate, happy-path render with current
 * speaker / no current speaker, timer alerts (1m / 30s / time-up),
 * audio-cue toggle, every queue control action (start/pause/resume/
 * complete/skip/end/move-entry/remove-entry) plus their fetch error
 * (response.error string, response.error.message, !ok with no error,
 * fetch throw Error, fetch throw non-Error), QR generation success +
 * failure, empty-queue copy, history-empty copy + history-render,
 * drag/drop handlers, Up/Down disabled at ends.
 */

import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    use<T>(usable: Promise<T> | T): T {
      const resolved = (usable as Promise<T> & { __testResolvedValue?: T })
        ?.__testResolvedValue;
      if (resolved !== undefined) return resolved;
      if (typeof actual.use === "function") {
        return actual.use(usable as never);
      }
      return usable as T;
    },
  };
});

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseLiveSession = jest.fn();
const mockGetRemaining = jest.fn();
const mockUseLiveTimerAudioAlerts = jest.fn();
jest.mock("@/lib/live-sessions/client", () => ({
  useLiveSession: (...args: unknown[]) => mockUseLiveSession(...args),
  getLiveRemainingSeconds: (...args: unknown[]) => mockGetRemaining(...args),
  useLiveTimerAudioAlerts: (...args: unknown[]) => mockUseLiveTimerAudioAlerts(...args),
}));

const mockQrToDataURL = jest.fn();
jest.mock("qrcode", () => ({
  __esModule: true,
  default: { toDataURL: (...args: unknown[]) => mockQrToDataURL(...args) },
  toDataURL: (...args: unknown[]) => mockQrToDataURL(...args),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt?: string; src?: string }) =>
    require("react").createElement("img", { alt: alt ?? "", src }),
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

import EmceePage from "@/app/live/[sessionId]/emcee/page";

const originalFetch = global.fetch;

const SESSION_ID = "live-sess-1";
const EMCEE_UID = "emcee-uid";

function authUser(uid = EMCEE_UID) {
  return {
    uid,
    email: `${uid}@test.com`,
    displayName: "Test Emcee",
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  };
}

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user === undefined ? authUser() : state.user,
    loading: state.loading ?? false,
  });
}

function makeSession(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: SESSION_ID,
    status: "live",
    title: "Boston Lightning Talks",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    emceeUid: EMCEE_UID,
    emceeName: "Test Emcee",
    audiencePath: `/live/${SESSION_ID}`,
    emceePath: `/live/${SESSION_ID}/emcee`,
    currentSpeaker: {
      entryId: "entry-current",
      speakerName: "Alex Rivera",
      talkTitle: "Agents in Production",
    },
    timer: {
      status: "running",
      durationSeconds: 300,
      remainingSeconds: 120,
      startedAtMs: Date.now() - 60_000,
      pausedAtMs: null,
      warningThresholds: [60, 30],
    },
    history: [],
    ...over,
  };
}

function makeQueueEntry(over: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...over,
  };
}

function setLiveSession(state: {
  session?: unknown;
  queue?: unknown[];
  loading?: boolean;
  error?: string | null;
} = {}) {
  mockUseLiveSession.mockReturnValue({
    session: state.session === undefined ? makeSession() : state.session,
    queue: state.queue ?? [],
    loading: state.loading ?? false,
    error: state.error ?? null,
  });
}

function params(sessionId: string) {
  const p = Promise.resolve({ sessionId }) as Promise<{ sessionId: string }> & {
    __testResolvedValue?: { sessionId: string };
  };
  p.__testResolvedValue = { sessionId };
  return p;
}

function mockFetchOk(response: unknown = { ok: true }) {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => response,
  })) as never;
}

function mockFetchErr(response: unknown = { error: "boom" }, status = 500) {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status,
    json: async () => response,
  })) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRemaining.mockReturnValue(120);
  mockUseLiveTimerAudioAlerts.mockReturnValue({
    audioEnabled: false,
    audioSupported: true,
    enableAudio: jest.fn().mockResolvedValue(true),
  });
  mockQrToDataURL.mockResolvedValue("data:image/png;base64,QR");
  setAuth();
  setLiveSession();
  mockFetchOk();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("EmceeLiveSessionPage — gates", () => {
  it("renders spinner while auth loads", () => {
    setAuth({ loading: true, user: null });
    const { container } = render(<EmceePage params={params(SESSION_ID)} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders spinner while live session loads", () => {
    setLiveSession({ loading: true, session: null });
    const { container } = render(<EmceePage params={params(SESSION_ID)} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders sign-in prompt when signed out", async () => {
    setAuth({ user: null });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Emcee Controls")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign In/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Sign In/i })).toHaveAttribute(
        "href",
        `/login?redirect=/live/${SESSION_ID}/emcee`,
      );
    });
  });

  it("renders 'Session not found' with the error message when present", async () => {
    setLiveSession({ session: null, error: "rtdb offline" });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Session not found")).toBeInTheDocument();
    expect(screen.getByText("rtdb offline")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create a Session/i })).toHaveAttribute(
      "href",
      "/live",
    );
  });

  it("renders 'Session not found' fallback copy when no error string", () => {
    setLiveSession({ session: null, error: null });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("This live session does not exist.")).toBeInTheDocument();
  });

  it("renders read-only access for non-emcee viewers", async () => {
    setAuth({ user: authUser("not-the-emcee") });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Read-only access")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Open Audience View/i }),
      ).toHaveAttribute("href", `/live/${SESSION_ID}`);
    });
  });
});

describe("EmceeLiveSessionPage — happy path", () => {
  it("renders session header and current speaker", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Boston Lightning Talks")).toBeInTheDocument();
    expect(screen.getByText("Agents in Production")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockQrToDataURL).toHaveBeenCalled();
    });
  });

  it("renders fallback copy when no current speaker", () => {
    setLiveSession({
      session: makeSession({
        currentSpeaker: { entryId: null, speakerName: null, talkTitle: null },
      }),
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("No speaker active")).toBeInTheDocument();
    expect(screen.getByText("Start a queue control action next.")).toBeInTheDocument();
  });

  it("renders QR image after it resolves", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => {
      expect(screen.getByAltText("QR code for audience live queue")).toBeInTheDocument();
    });
  });

  it("renders 'Generating QR code...' when QR generation rejects", async () => {
    mockQrToDataURL.mockRejectedValueOnce(new Error("qr failed"));
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => {
      expect(screen.getByText(/Generating QR code/i)).toBeInTheDocument();
    });
  });

  it("renders empty queue message when no queued speakers", () => {
    setLiveSession({ queue: [] });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(
      screen.getByText(/No one is queued yet/i),
    ).toBeInTheDocument();
  });

  it("renders empty history copy when history is empty", () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(
      screen.getByText(/Finished talks will appear here/i),
    ).toBeInTheDocument();
  });

  it("renders history entries (reversed) when present", () => {
    setLiveSession({
      session: makeSession({
        history: [
          {
            entryId: "hist-1",
            userId: "u1",
            speakerName: "Past Speaker",
            talkTitle: "Old talk",
            durationMinutes: 3,
            outcome: "completed",
            startedAtMs: Date.now() - 5 * 60_000,
            finishedAtMs: Date.now() - 4 * 60_000,
          },
        ],
      }),
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Old talk")).toBeInTheDocument();
    expect(screen.getByText("Past Speaker")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});

describe("EmceeLiveSessionPage — timer alerts + audio", () => {
  it("shows the 1-minute warning", () => {
    mockGetRemaining.mockReturnValue(60);
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("1 minute warning")).toBeInTheDocument();
  });

  it("shows the 30-second warning", () => {
    mockGetRemaining.mockReturnValue(20);
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("30 second warning")).toBeInTheDocument();
  });

  it("shows 'Time is up' when remaining is 0", () => {
    mockGetRemaining.mockReturnValue(0);
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Time is up")).toBeInTheDocument();
  });

  it("omits alert when timer is not running", () => {
    mockGetRemaining.mockReturnValue(20);
    setLiveSession({
      session: makeSession({
        timer: {
          status: "paused",
          durationSeconds: 300,
          remainingSeconds: 20,
          startedAtMs: null,
          pausedAtMs: Date.now(),
          warningThresholds: [60, 30],
        },
      }),
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.queryByText(/30 second warning/i)).toBeNull();
    expect(screen.queryByText(/1 minute warning/i)).toBeNull();
    expect(screen.queryByText(/Time is up/i)).toBeNull();
  });

  it("hides the audio toggle when audio is not supported", () => {
    mockUseLiveTimerAudioAlerts.mockReturnValue({
      audioEnabled: false,
      audioSupported: false,
      enableAudio: jest.fn(),
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.queryByRole("button", { name: /Enable Sound Cues/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sound Cues On/i })).toBeNull();
  });

  it("toggles between Enable Sound Cues and Sound Cues On states", () => {
    const enableAudio = jest.fn().mockResolvedValue(true);
    mockUseLiveTimerAudioAlerts.mockReturnValue({
      audioEnabled: false,
      audioSupported: true,
      enableAudio,
    });
    const { rerender } = render(<EmceePage params={params(SESSION_ID)} />);
    const btn = screen.getByRole("button", { name: /Enable Sound Cues/i });
    fireEvent.click(btn);
    expect(enableAudio).toHaveBeenCalled();

    mockUseLiveTimerAudioAlerts.mockReturnValue({
      audioEnabled: true,
      audioSupported: true,
      enableAudio,
    });
    rerender(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByRole("button", { name: /Sound Cues On/i })).toBeInTheDocument();
  });
});

describe("EmceeLiveSessionPage — control actions", () => {
  async function waitForSessionIdResolved() {
    // sessionId is set via params.then(setSessionId) — wait for the QR
    // useEffect to flush (it only fires once sessionId is non-empty).
    await waitFor(() => {
      expect(mockQrToDataURL).toHaveBeenCalled();
    });
  }

  it("Start Next dispatches start-next and shows success message", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    fireEvent.click(screen.getByRole("button", { name: /Start Next/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/live/${SESSION_ID}/control`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.getByText(/Started the next speaker\./i)).toBeInTheDocument();
  });

  it("Pause shows 'Timer paused.' on success", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    fireEvent.click(screen.getByRole("button", { name: /^Pause$/ }));
    await waitFor(() => {
      expect(screen.getByText(/Timer paused\./i)).toBeInTheDocument();
    });
  });

  it("Resume shows 'Timer resumed.' on success", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    fireEvent.click(screen.getByRole("button", { name: /^Resume$/ }));
    await waitFor(() => {
      expect(screen.getByText(/Timer resumed\./i)).toBeInTheDocument();
    });
  });

  it("Complete shows 'Speaker marked complete.' on success", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    fireEvent.click(screen.getByRole("button", { name: /^Complete$/ }));
    await waitFor(() => {
      expect(screen.getByText(/Speaker marked complete\./i)).toBeInTheDocument();
    });
  });

  it("Skip shows 'Speaker skipped.' on success", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    await waitFor(() => {
      expect(screen.getByText(/Speaker skipped\./i)).toBeInTheDocument();
    });
  });

  it("End Session shows 'Session ended.' on success", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    fireEvent.click(screen.getByRole("button", { name: /End Session/i }));
    await waitFor(() => {
      expect(screen.getByText(/Session ended\./i)).toBeInTheDocument();
    });
  });

  it("surfaces response.error string when !ok", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    mockFetchErr({ error: "not your session" });
    fireEvent.click(screen.getByRole("button", { name: /Start Next/i }));
    await waitFor(() => {
      expect(screen.getByText(/not your session/i)).toBeInTheDocument();
    });
  });

  it("falls back to 'Could not update live session.' when no error in body", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    mockFetchErr({});
    fireEvent.click(screen.getByRole("button", { name: /Start Next/i }));
    await waitFor(() => {
      expect(screen.getByText(/Could not update live session\./i)).toBeInTheDocument();
    });
  });

  it("falls back to default message when fetch throws non-Error", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    global.fetch = jest.fn(async () => {
      throw "string-error";
    }) as never;
    fireEvent.click(screen.getByRole("button", { name: /Start Next/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Could not update live session\./i),
      ).toBeInTheDocument();
    });
  });

  it("surfaces fetch throw Error message", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    global.fetch = jest.fn(async () => {
      throw new Error("network blew up");
    }) as never;
    fireEvent.click(screen.getByRole("button", { name: /Start Next/i }));
    await waitFor(() => {
      expect(screen.getByText(/network blew up/i)).toBeInTheDocument();
    });
  });

  it("handles json() throwing (catch → {} fallback)", async () => {
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitForSessionIdResolved();
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("bad json");
      },
    })) as never;
    fireEvent.click(screen.getByRole("button", { name: /Start Next/i }));
    await waitFor(() => {
      expect(screen.getByText(/Could not update live session\./i)).toBeInTheDocument();
    });
  });

  it("renders no action buttons when signed out", () => {
    setAuth({ user: null });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.queryByRole("button", { name: /Start Next/i })).toBeNull();
  });
});

describe("EmceeLiveSessionPage — queue rows + drag/drop", () => {
  it("renders queued speakers and exposes Up/Down/Remove", () => {
    setLiveSession({
      queue: [
        makeQueueEntry({ id: "q1", speakerName: "Speaker One", talkTitle: "First" }),
        makeQueueEntry({ id: "q2", speakerName: "Speaker Two", talkTitle: "Second" }),
      ],
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Up/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Down/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Remove/i }).length).toBe(2);
  });

  it("Up button disabled at index 0, Down at last index", () => {
    setLiveSession({
      queue: [
        makeQueueEntry({ id: "q1", talkTitle: "First" }),
        makeQueueEntry({ id: "q2", talkTitle: "Second" }),
      ],
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    const upButtons = screen.getAllByRole("button", { name: /^Up$/ });
    const downButtons = screen.getAllByRole("button", { name: /^Down$/ });
    expect(upButtons[0]).toBeDisabled();
    expect(upButtons[1]).not.toBeDisabled();
    expect(downButtons[0]).not.toBeDisabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it("Up moves entry (move-entry, targetIndex max(0, idx-1))", async () => {
    setLiveSession({
      queue: [
        makeQueueEntry({ id: "q1", talkTitle: "First" }),
        makeQueueEntry({ id: "q2", talkTitle: "Second" }),
      ],
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => expect(mockQrToDataURL).toHaveBeenCalled());
    const upButtons = screen.getAllByRole("button", { name: /^Up$/ });
    fireEvent.click(upButtons[1]);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(body).toMatchObject({
      action: "move-entry",
      entryId: "q2",
      targetIndex: 0,
    });
  });

  it("Down moves entry (move-entry, targetIndex min(len-1, idx+1))", async () => {
    setLiveSession({
      queue: [
        makeQueueEntry({ id: "q1", talkTitle: "First" }),
        makeQueueEntry({ id: "q2", talkTitle: "Second" }),
      ],
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => expect(mockQrToDataURL).toHaveBeenCalled());
    const downButtons = screen.getAllByRole("button", { name: /^Down$/ });
    fireEvent.click(downButtons[0]);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(body).toMatchObject({
      action: "move-entry",
      entryId: "q1",
      targetIndex: 1,
    });
  });

  it("Remove dispatches remove-entry and shows success message", async () => {
    setLiveSession({ queue: [makeQueueEntry({ id: "q1" })] });
    render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => expect(mockQrToDataURL).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Remove/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Speaker removed from queue\./i),
      ).toBeInTheDocument();
    });
  });

  it("drag start → drop dispatches move-entry with the dragged id", async () => {
    setLiveSession({
      queue: [
        makeQueueEntry({ id: "q1", talkTitle: "First" }),
        makeQueueEntry({ id: "q2", talkTitle: "Second" }),
      ],
    });
    const { container } = render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => expect(mockQrToDataURL).toHaveBeenCalled());
    const cards = container.querySelectorAll("[draggable='true']");
    expect(cards.length).toBe(2);

    fireEvent.dragStart(cards[0]);
    fireEvent.dragOver(cards[1]);
    fireEvent.drop(cards[1]);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(body).toMatchObject({
      action: "move-entry",
      entryId: "q1",
      targetIndex: 1,
    });

    // dragEnd resets dragged state
    fireEvent.dragEnd(cards[0]);
  });

  it("drop without a dragStart is a no-op", async () => {
    setLiveSession({
      queue: [makeQueueEntry({ id: "q1" }), makeQueueEntry({ id: "q2" })],
    });
    const { container } = render(<EmceePage params={params(SESSION_ID)} />);
    await waitFor(() => expect(mockQrToDataURL).toHaveBeenCalled());
    const cards = container.querySelectorAll("[draggable='true']");
    fireEvent.drop(cards[1]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("filters out non-queued entries from the queued list", () => {
    setLiveSession({
      queue: [
        makeQueueEntry({ id: "q1", talkTitle: "Queued one" }),
        makeQueueEntry({ id: "q2", talkTitle: "Already gone", status: "completed" }),
      ],
    });
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("Queued one")).toBeInTheDocument();
    expect(screen.queryByText("Already gone")).toBeNull();
  });
});

describe("EmceeLiveSessionPage — timer tick", () => {
  it("advances the displayed remaining seconds via setInterval", () => {
    jest.useFakeTimers();
    let value = 120;
    mockGetRemaining.mockImplementation(() => value);
    render(<EmceePage params={params(SESSION_ID)} />);
    expect(screen.getByText("2:00")).toBeInTheDocument();
    act(() => {
      value = 119;
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("1:59")).toBeInTheDocument();
    jest.useRealTimers();
  });
});
