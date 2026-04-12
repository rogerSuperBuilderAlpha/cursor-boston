import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

// Mock ProfileRequirementsModal
jest.mock("@/components/ProfileRequirementsModal", () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="requirements-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

const mockGetIdToken = jest.fn().mockResolvedValue("test-token");
const mockUser = { uid: "u1", getIdToken: mockGetIdToken };

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

import { useAuth } from "@/contexts/AuthContext";
import CoworkingSlots from "@/components/events/CoworkingSlots";

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function mockAuthUser(user: typeof mockUser | null) {
  mockedUseAuth.mockReturnValue({
    user,
    loading: false,
  } as ReturnType<typeof useAuth>);
}

// Helpers for building slot API responses
function makeSession(overrides: Partial<{
  id: string;
  label: string;
  maxSlots: number;
  currentBookings: number;
}> = {}) {
  return {
    id: overrides.id ?? "s1",
    eventId: "evt1",
    startTime: "2026-04-12T09:00:00Z",
    endTime: "2026-04-12T12:00:00Z",
    label: overrides.label ?? "Morning Session",
    maxSlots: overrides.maxSlots ?? 10,
    currentBookings: overrides.currentBookings ?? 3,
  };
}

function makeSlotStatus(overrides: Partial<{
  session: ReturnType<typeof makeSession>;
  availableSlots: number;
  isUserRegistered: boolean;
  attendees: Array<{ displayName: string; photoUrl?: string; github?: string }>;
}> = {}) {
  return {
    session: overrides.session ?? makeSession(),
    availableSlots: overrides.availableSlots ?? 7,
    isUserRegistered: overrides.isUserRegistered ?? false,
    userRegistrationId: undefined,
    attendees: overrides.attendees ?? [],
  };
}

// Shared fetch mock setup
const originalFetch = globalThis.fetch;
let mockFetchFn: jest.Mock;

function setupFetch(
  slotsResponse: object,
  eligibilityResponse: object = { eligible: true },
) {
  mockFetchFn = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/slots")) {
      return Promise.resolve({
        json: () => Promise.resolve(slotsResponse),
      } as Response);
    }
    if (url.includes("/eligibility")) {
      return Promise.resolve({
        json: () => Promise.resolve(eligibilityResponse),
      } as Response);
    }
    if (url.includes("/register")) {
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      } as Response);
    }
    return Promise.resolve({
      json: () => Promise.resolve({}),
    } as Response);
  });
  globalThis.fetch = mockFetchFn;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("CoworkingSlots", () => {
  describe("loading state", () => {
    it("shows skeleton placeholders while loading", () => {
      // fetch never resolves
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as typeof fetch;
      mockAuthUser(null);
      const { container } = render(<CoworkingSlots eventId="evt1" />);
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("unauthenticated user", () => {
    it("shows sign-in notice when not logged in", async () => {
      mockAuthUser(null);
      setupFetch(
        { success: true, sessions: [makeSlotStatus()] },
        { eligible: false, reason: "Please sign in to register for coworking." },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("Registration Requirements")).toBeInTheDocument();
      });
      expect(screen.getByText(/Please sign in/)).toBeInTheDocument();
      expect(screen.getByText("Sign in to continue →")).toBeInTheDocument();
    });
  });

  describe("authenticated user - eligible", () => {
    beforeEach(() => {
      mockAuthUser(mockUser as never);
    });

    it("renders session cards after loading", async () => {
      const slots = [
        makeSlotStatus({ session: makeSession({ label: "Morning Session" }) }),
        makeSlotStatus({
          session: makeSession({ id: "s2", label: "Afternoon Session" }),
        }),
      ];
      setupFetch({ success: true, sessions: slots }, { eligible: true });

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("Morning Session")).toBeInTheDocument();
      });
      expect(screen.getByText("Afternoon Session")).toBeInTheDocument();
    });

    it("shows available spot count", async () => {
      setupFetch(
        {
          success: true,
          sessions: [makeSlotStatus({ availableSlots: 5, session: makeSession({ maxSlots: 10 }) })],
        },
        { eligible: true },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText(/5 of 10 spots available/)).toBeInTheDocument();
      });
    });

    it("shows Register button when eligible and not full", async () => {
      setupFetch(
        { success: true, sessions: [makeSlotStatus({ availableSlots: 3 })] },
        { eligible: true },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
      });
    });

    it("shows Full when no available slots", async () => {
      setupFetch(
        {
          success: true,
          sessions: [
            makeSlotStatus({
              availableSlots: 0,
              session: makeSession({ currentBookings: 10, maxSlots: 10 }),
            }),
          ],
        },
        { eligible: true },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("Full")).toBeInTheDocument();
      });
    });

    it("shows registered status when user is registered", async () => {
      setupFetch(
        {
          success: true,
          sessions: [
            makeSlotStatus({
              isUserRegistered: true,
              session: makeSession({ label: "Morning Session" }),
            }),
          ],
        },
        { eligible: true },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("You're registered!")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("calls register endpoint when Register is clicked", async () => {
      const user = userEvent.setup();
      setupFetch(
        { success: true, sessions: [makeSlotStatus({ availableSlots: 3 })] },
        { eligible: true },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Register" }));

      await waitFor(() => {
        const registerCalls = mockFetchFn.mock.calls.filter(
          (call: [RequestInfo | URL, RequestInit?]) =>
            typeof call[0] === "string" && call[0].includes("/register"),
        );
        expect(registerCalls.length).toBeGreaterThanOrEqual(1);
        expect(registerCalls[0][1]?.method).toBe("POST");
      });
    });

    it("expands attendee list on click", async () => {
      const user = userEvent.setup();
      const attendees = [
        { displayName: "Alice", photoUrl: "https://example.com/alice.jpg", github: "alice" },
        { displayName: "Bob" },
      ];
      setupFetch(
        {
          success: true,
          sessions: [makeSlotStatus({ attendees })],
        },
        { eligible: true },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("2 registered")).toBeInTheDocument();
      });

      await user.click(screen.getByText("2 registered"));

      await waitFor(() => {
        expect(screen.getByText("Registered Attendees")).toBeInTheDocument();
      });
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      // Alice has a photo
      expect(screen.getByAltText("Alice")).toBeInTheDocument();
      // Bob has initial avatar
      expect(screen.getByText("B")).toBeInTheDocument();
    });
  });

  describe("ineligible user", () => {
    it("shows Complete Requirements button when logged in but ineligible", async () => {
      mockAuthUser(mockUser as never);
      setupFetch(
        { success: true, sessions: [makeSlotStatus()] },
        { eligible: false, reason: "You need a public profile and GitHub linked." },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("Registration Requirements")).toBeInTheDocument();
      });
      expect(screen.getByText("Complete Requirements →")).toBeInTheDocument();
    });

    it("shows Unavailable instead of Register when ineligible", async () => {
      mockAuthUser(mockUser as never);
      setupFetch(
        { success: true, sessions: [makeSlotStatus({ availableSlots: 3 })] },
        { eligible: false, reason: "Incomplete profile." },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("Unavailable")).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: "Register" })).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("shows error message when slots API fails", async () => {
      mockAuthUser(null);
      setupFetch(
        { success: false, error: "Server error" },
        { eligible: false, reason: "Please sign in." },
      );

      render(<CoworkingSlots eventId="evt1" />);

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });
  });

  it("renders the info note about one session per event", async () => {
    mockAuthUser(null);
    setupFetch(
      { success: true, sessions: [makeSlotStatus()] },
      { eligible: false, reason: "Sign in." },
    );

    render(<CoworkingSlots eventId="evt1" />);

    await waitFor(() => {
      expect(
        screen.getByText(/You can only register for one session per event/),
      ).toBeInTheDocument();
    });
  });
});
