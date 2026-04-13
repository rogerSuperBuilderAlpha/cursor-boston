import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WelcomeModal from "@/components/WelcomeModal";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("WelcomeModal", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it("shows the modal when welcome key is not set", () => {
    render(<WelcomeModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Cursor Boston!")).toBeInTheDocument();
  });

  it("does not show the modal when welcome key is already set", () => {
    localStorageMock.getItem.mockReturnValueOnce("true");
    render(<WelcomeModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders Discord, Events, and Luma CTAs", () => {
    render(<WelcomeModal />);
    expect(screen.getByText("Join Our Discord")).toBeInTheDocument();
    expect(screen.getByText("View Upcoming Events")).toBeInTheDocument();
    expect(screen.getByText("Register for Event")).toBeInTheDocument();
  });

  it("closes modal and sets localStorage when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<WelcomeModal />);
    await user.click(screen.getByRole("button", { name: /close welcome/i }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith("cursor-boston-welcome-seen", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal when Maybe later is clicked", async () => {
    const user = userEvent.setup();
    render(<WelcomeModal />);
    await user.click(screen.getByText("Maybe later"));
    expect(localStorageMock.setItem).toHaveBeenCalledWith("cursor-boston-welcome-seen", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes modal on Escape key", async () => {
    const user = userEvent.setup();
    render(<WelcomeModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has aria-modal and aria-labelledby on the dialog", () => {
    render(<WelcomeModal />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "welcome-title");
  });
});
