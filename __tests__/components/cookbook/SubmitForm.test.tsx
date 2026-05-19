import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({
  getIdToken: jest.fn().mockResolvedValue("test-token"),
}));

import { getIdToken } from "firebase/auth";
import { SubmitForm } from "@/components/cookbook/SubmitForm";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: "user-1",
    displayName: "Alice",
    email: "alice@example.com",
    ...overrides,
  } as User;
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    user: makeUser(),
    onSuccess: jest.fn(),
    isSubmitting: false,
    setIsSubmitting: jest.fn(),
    error: null as string | null,
    setError: jest.fn(),
    ...overrides,
  };
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
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SubmitForm", () => {
  it("shows sign-in prompt when user is null", () => {
    render(<SubmitForm {...defaultProps({ user: null })} />);
    expect(screen.getByText("Sign in to submit a prompt or rule.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/login?redirect=/cookbook",
    );
  });

  it("renders form fields for authenticated users", () => {
    render(<SubmitForm {...defaultProps()} />);
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt or Rule Content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tags/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("submits entry and calls onSuccess", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    setupFetch({});

    render(<SubmitForm {...props} />);

    await user.type(screen.getByLabelText(/Title/i), "Debug helper");
    await user.type(screen.getByLabelText(/Description/i), "Helps debug issues");
    await user.type(screen.getByLabelText(/Prompt or Rule Content/i), "Analyze the stack trace");
    await user.type(screen.getByLabelText(/Tags/i), "debugging, cursor");
    await user.click(screen.getByRole("checkbox", { name: "TypeScript" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(props.onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(getIdToken).toHaveBeenCalledWith(props.user);
    expect(mockFetchFn).toHaveBeenCalledWith("/api/cookbook/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        title: "Debug helper",
        description: "Helps debug issues",
        promptContent: "Analyze the stack trace",
        category: "other",
        tags: ["debugging", "cursor"],
        worksWith: ["TypeScript"],
      }),
    });
    expect(screen.getByLabelText(/Title/i)).toHaveValue("");
  });

  it("shows API error message on failure", async () => {
    const user = userEvent.setup();
    const setError = jest.fn();
    setupFetch({ error: "Title already exists" }, false);

    render(
      <SubmitForm
        {...defaultProps({ setError })}
      />,
    );

    await user.type(screen.getByLabelText(/Title/i), "Duplicate");
    await user.type(screen.getByLabelText(/Description/i), "Desc");
    await user.type(screen.getByLabelText(/Prompt or Rule Content/i), "Prompt");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith("Title already exists");
    });
  });

  it("shows inline error when provided", () => {
    render(<SubmitForm {...defaultProps({ error: "Something went wrong" })} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows submitting state from props", () => {
    render(<SubmitForm {...defaultProps({ isSubmitting: true })} />);
    expect(screen.getByText("Submitting...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submitting/i })).toBeDisabled();
  });

  afterEach(() => {
    mockFetchFn = jest.fn();
    globalThis.fetch = mockFetchFn;
  });

  it("sets network error when fetch throws", async () => {
    const user = userEvent.setup();
    const setError = jest.fn();
    mockFetchFn = jest.fn().mockRejectedValue(new Error("offline"));
    globalThis.fetch = mockFetchFn;

    render(<SubmitForm {...defaultProps({ setError })} />);

    await user.type(screen.getByLabelText(/Title/i), "Title");
    await user.type(screen.getByLabelText(/Description/i), "Desc");
    await user.type(screen.getByLabelText(/Prompt or Rule Content/i), "Prompt");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith("Failed to submit");
    });
  });
});
