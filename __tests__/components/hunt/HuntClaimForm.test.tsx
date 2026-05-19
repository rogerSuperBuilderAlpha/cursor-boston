import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockGetIdToken = jest.fn().mockResolvedValue("test-token");
const mockUser = { uid: "u1", getIdToken: mockGetIdToken };

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

import { useAuth } from "@/contexts/AuthContext";
import { HuntClaimForm } from "@/components/hunt/HuntClaimForm";

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function mockAuthUser(user: typeof mockUser | null) {
  mockedUseAuth.mockReturnValue({
    user,
    loading: false,
  } as ReturnType<typeof useAuth>);
}

const originalFetch = globalThis.fetch;
let mockFetchFn: jest.Mock;

function setupFetch(response: object, ok = true) {
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

describe("HuntClaimForm", () => {
  it("renders answer input and submit control", () => {
    render(<HuntClaimForm pathId="test-path" />);
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to submit" })).toBeInTheDocument();
  });

  it("prefills initialAnswer", () => {
    render(<HuntClaimForm pathId="test-path" initialAnswer="secret-code" />);
    expect(screen.getByLabelText("Your answer")).toHaveValue("secret-code");
  });

  it("disables submit when user is not signed in", () => {
    render(<HuntClaimForm pathId="test-path" />);
    expect(screen.getByRole("button", { name: "Sign in to submit" })).toBeDisabled();
  });

  it("shows Submit label when user is signed in", () => {
    mockAuthUser(mockUser as never);
    render(<HuntClaimForm pathId="test-path" />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("submits answer and shows success message", async () => {
    const user = userEvent.setup();
    mockAuthUser(mockUser as never);
    setupFetch({ ok: true, message: "Prize claimed!" });

    render(<HuntClaimForm pathId="alpha-path" />);
    await user.type(screen.getByLabelText("Your answer"), "correct-answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Prize claimed!");
    });
    expect(mockFetchFn).toHaveBeenCalledWith("/api/hunt/paths/alpha-path/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ answer: "correct-answer" }),
    });
  });

  it("maps known failure reasons to friendly messages", async () => {
    const user = userEvent.setup();
    mockAuthUser(mockUser as never);
    setupFetch({ ok: false, reason: "wrong_answer" });

    render(<HuntClaimForm pathId="beta-path" />);
    await user.type(screen.getByLabelText("Your answer"), "wrong");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("That's not it. Try again.");
    });
  });

  it("shows network error when fetch throws", async () => {
    const user = userEvent.setup();
    mockAuthUser(mockUser as never);
    mockFetchFn = jest.fn().mockRejectedValue(new Error("offline"));
    globalThis.fetch = mockFetchFn;

    render(<HuntClaimForm pathId="gamma-path" />);
    await user.type(screen.getByLabelText("Your answer"), "answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Network error.");
    });
  });

  it("shows Submitting… while request is in flight", async () => {
    const user = userEvent.setup();
    mockAuthUser(mockUser as never);
    mockFetchFn = jest.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ ok: true }),
              } as Response),
            50,
          );
        }),
    );
    globalThis.fetch = mockFetchFn;

    render(<HuntClaimForm pathId="delta-path" />);
    await user.type(screen.getByLabelText("Your answer"), "answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
  });
});
