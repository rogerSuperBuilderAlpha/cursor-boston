import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockGetIdToken = jest.fn().mockResolvedValue("test-token");
const mockUser = { uid: "u1", getIdToken: mockGetIdToken };

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

import { useAuth } from "@/contexts/AuthContext";
import { KonamiListener } from "@/components/hunt/KonamiListener";

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function mockAuthUser(user: typeof mockUser | null) {
  mockedUseAuth.mockReturnValue({
    user,
    loading: false,
  } as ReturnType<typeof useAuth>);
}

function typeKonamiSequence() {
  for (const key of KONAMI_SEQUENCE) {
    fireEvent.keyDown(window, { key });
  }
}

const originalFetch = globalThis.fetch;
let mockFetchFn: jest.Mock;

function setupKonamiFetch(response: object, ok = true) {
  mockFetchFn = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  } as Response);
  globalThis.fetch = mockFetchFn;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthUser(null);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("KonamiListener", () => {
  it("renders nothing before the sequence is entered", () => {
    const { container } = render(<KonamiListener />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reveals token dialog after konami sequence succeeds", async () => {
    setupKonamiFetch({ token: "konami-secret-token" });
    render(<KonamiListener />);

    typeKonamiSequence();

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Konami path" })).toBeInTheDocument();
    });
    expect(screen.getByText("🎮 You found a path.")).toBeInTheDocument();
    expect(screen.getByText(/token: konami-secret-token/)).toBeInTheDocument();
    expect(mockFetchFn).toHaveBeenCalledWith("/api/hunt/oracle/konami", {
      headers: { "X-Konami-Sequence": "UUDDLRLRBA" },
    });
  });

  it("shows sign-in prompt when token revealed but user is not signed in", async () => {
    setupKonamiFetch({ token: "konami-secret-token" });
    render(<KonamiListener />);

    typeKonamiSequence();

    await waitFor(() => {
      expect(
        screen.getByText("Sign in and connect GitHub + Discord to claim."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Claim prize" })).not.toBeInTheDocument();
  });

  it("shows error when konami oracle request fails", async () => {
    setupKonamiFetch({}, false);
    render(<KonamiListener />);

    typeKonamiSequence();

    await waitFor(() => {
      expect(screen.getByText("Not today.")).toBeInTheDocument();
    });
  });

  it("claims prize when signed-in user clicks Claim prize", async () => {
    const user = userEvent.setup();
    mockAuthUser(mockUser as never);

    mockFetchFn = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/oracle/konami")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: "konami-secret-token" }),
        } as Response);
      }
      if (url.includes("/paths/konami/submit")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, message: "Claimed. Check your email." }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
    globalThis.fetch = mockFetchFn;

    render(<KonamiListener />);
    typeKonamiSequence();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Claim prize" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Claim prize" }));

    await waitFor(() => {
      expect(screen.getByText("Claimed. Check your email.")).toBeInTheDocument();
    });

    const submitCall = mockFetchFn.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("/paths/konami/submit"),
    );
    expect(submitCall?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ answer: "konami-secret-token" }),
    });
  });

  it("closes dialog when Close is clicked", async () => {
    const user = userEvent.setup();
    setupKonamiFetch({ token: "konami-secret-token" });
    render(<KonamiListener />);

    typeKonamiSequence();

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Konami path" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Konami path" })).not.toBeInTheDocument();
  });
});
