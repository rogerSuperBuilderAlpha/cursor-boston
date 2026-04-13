import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlphabetNav } from "@/components/glossary/AlphabetNav";

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    activeLetter: null as string | null,
    onLetterClick: jest.fn(),
    availableLetters: new Set(["A", "B", "C"]),
    ...overrides,
  };
}

describe("AlphabetNav", () => {
  it("renders the ALL button and 26 letter buttons", () => {
    render(<AlphabetNav {...defaultProps()} />);
    expect(screen.getByRole("button", { name: "ALL" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(27); // ALL + 26 letters
  });

  it("calls onLetterClick with empty string when ALL is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<AlphabetNav {...props} />);
    await user.click(screen.getByRole("button", { name: "ALL" }));
    expect(props.onLetterClick).toHaveBeenCalledWith("");
  });

  it("calls onLetterClick when an available letter is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<AlphabetNav {...props} />);
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(props.onLetterClick).toHaveBeenCalledWith("A");
  });

  it("disables letters that have no terms", () => {
    render(<AlphabetNav {...defaultProps()} />);
    expect(screen.getByRole("button", { name: "Z" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "A" })).toBeEnabled();
  });

  it("does not call onLetterClick for disabled letters", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<AlphabetNav {...props} />);
    await user.click(screen.getByRole("button", { name: "Z" }));
    expect(props.onLetterClick).not.toHaveBeenCalledWith("Z");
  });
});
