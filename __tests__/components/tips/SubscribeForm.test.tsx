import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubscribeForm } from "@/components/tips/SubscribeForm";

describe("SubscribeForm", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("renders email input and subscribe button", () => {
    render(<SubscribeForm />);
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
  });

  it("shows success message after subscribing", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Subscribed" }),
    });

    render(<SubscribeForm />);
    await user.type(screen.getByPlaceholderText("your@email.com"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(screen.getByText(/you're subscribed/i)).toBeInTheDocument();
    });
  });

  it("shows error on failure", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Already subscribed" } }),
    });

    render(<SubscribeForm />);
    await user.type(screen.getByPlaceholderText("your@email.com"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(screen.getByText("Already subscribed")).toBeInTheDocument();
    });
  });
});
