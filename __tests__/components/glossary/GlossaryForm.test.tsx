import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUser = { uid: "u1", displayName: "Alice" };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: mockUser })),
}));

jest.mock("firebase/auth", () => ({
  getIdToken: jest.fn(() => Promise.resolve("mock-token")),
}));

jest.mock("@/lib/firebase", () => ({ db: null }));

import { useAuth } from "@/contexts/AuthContext";
import { GlossaryForm } from "@/components/glossary/GlossaryForm";

describe("GlossaryForm", () => {
  const onSuccess = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    global.fetch = jest.fn();
  });

  it("shows sign-in CTA when user is not logged in", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    render(<GlossaryForm onSuccess={onSuccess} />);
    expect(screen.getByText(/sign in to contribute/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?redirect=/glossary");
  });

  it("renders the form when user is logged in", () => {
    render(<GlossaryForm onSuccess={onSuccess} />);
    expect(screen.getByPlaceholderText("e.g. Multi-cursor editing")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe the concept in detail...")).toBeInTheDocument();
    expect(screen.getByText("Term Name")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Definition")).toBeInTheDocument();
  });

  it("renders the submit button with Add Term text", () => {
    render(<GlossaryForm onSuccess={onSuccess} />);
    expect(screen.getByRole("button", { name: /add term/i })).toBeInTheDocument();
  });

  it("renders Suggest Edit when initialData is provided", () => {
    render(
      <GlossaryForm
        initialData={{ term: "Foo", definition: "Bar" }}
        onSuccess={onSuccess}
      />
    );
    expect(screen.getByRole("button", { name: /suggest edit/i })).toBeInTheDocument();
  });

  it("renders the cancel button when onCancel is provided", () => {
    render(<GlossaryForm onSuccess={onSuccess} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<GlossaryForm onSuccess={onSuccess} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("submits the form and calls onSuccess with the slug", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slug: "my-term" }),
    });

    render(<GlossaryForm onSuccess={onSuccess} />);
    await user.type(screen.getByPlaceholderText("e.g. Multi-cursor editing"), "My Term");
    await user.type(screen.getByPlaceholderText("Describe the concept in detail..."), "A definition of my term");
    await user.click(screen.getByRole("button", { name: /add term/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("my-term");
    });
  });

  it("shows an error message when submission fails", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Term already exists" } }),
    });

    render(<GlossaryForm onSuccess={onSuccess} />);
    await user.type(screen.getByPlaceholderText("e.g. Multi-cursor editing"), "Duplicate");
    await user.type(screen.getByPlaceholderText("Describe the concept in detail..."), "Some definition");
    await user.click(screen.getByRole("button", { name: /add term/i }));

    await waitFor(() => {
      expect(screen.getByText("Term already exists")).toBeInTheDocument();
    });
  });
});
