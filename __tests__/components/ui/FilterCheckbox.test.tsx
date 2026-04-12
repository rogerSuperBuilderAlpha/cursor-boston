import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterCheckbox } from "@/components/members/FilterCheckbox";

describe("FilterCheckbox", () => {
  const defaultProps = {
    checked: false,
    onChange: jest.fn(),
    label: "Active",
    icon: <span data-testid="icon">icon</span>,
  };

  beforeEach(() => {
    (defaultProps.onChange as jest.Mock).mockClear();
  });

  it("renders without crashing", () => {
    render(<FilterCheckbox {...defaultProps} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders the icon", () => {
    render(<FilterCheckbox {...defaultProps} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders a hidden checkbox input", () => {
    render(<FilterCheckbox {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", { hidden: true });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("reflects checked state", () => {
    render(<FilterCheckbox {...defaultProps} checked={true} />);
    const checkbox = screen.getByRole("checkbox", { hidden: true });
    expect(checkbox).toBeChecked();
  });

  it("calls onChange when clicked", () => {
    render(<FilterCheckbox {...defaultProps} />);
    fireEvent.click(screen.getByText("Active"));
    expect(defaultProps.onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when unchecking", () => {
    render(<FilterCheckbox {...defaultProps} checked={true} />);
    fireEvent.click(screen.getByText("Active"));
    expect(defaultProps.onChange).toHaveBeenCalledWith(false);
  });

  it("applies checked styling", () => {
    const { container } = render(<FilterCheckbox {...defaultProps} checked={true} />);
    const label = container.querySelector("label");
    expect(label?.className).toContain("bg-emerald-500/10");
  });

  it("applies unchecked styling", () => {
    const { container } = render(<FilterCheckbox {...defaultProps} checked={false} />);
    const label = container.querySelector("label");
    expect(label?.className).toContain("bg-neutral-100");
  });
});
