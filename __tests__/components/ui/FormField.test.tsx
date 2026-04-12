import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormInput, FormTextarea, ToggleSwitch } from "@/components/ui/FormField";

describe("FormInput", () => {
  it("renders without crashing", () => {
    render(<FormInput id="test" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with a label", () => {
    render(<FormInput id="name" label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("does not render a label when not provided", () => {
    const { container } = render(<FormInput id="test" />);
    expect(container.querySelector("label")).toBeNull();
  });

  it("displays error message", () => {
    render(<FormInput id="email" error="Invalid email" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
  });

  it("does not render error when null", () => {
    render(<FormInput id="email" error={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sets aria-describedby when error is present", () => {
    render(<FormInput id="field" error="Required" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-describedby", "field-error");
  });

  it("passes through extra input props", () => {
    render(<FormInput id="test" placeholder="Enter text" type="email" />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toHaveAttribute("type", "email");
  });
});

describe("FormTextarea", () => {
  it("renders without crashing", () => {
    render(<FormTextarea id="bio" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with a label", () => {
    render(<FormTextarea id="bio" label="Bio" />);
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<FormTextarea id="bio" error="Too short" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  it("defaults to 3 rows", () => {
    render(<FormTextarea id="bio" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "3");
  });

  it("accepts custom rows", () => {
    render(<FormTextarea id="bio" rows={6} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "6");
  });

  it("sets aria-describedby when error present", () => {
    render(<FormTextarea id="desc" error="Error" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "desc-error");
  });
});

describe("ToggleSwitch", () => {
  it("renders without crashing", () => {
    render(<ToggleSwitch checked={false} onChange={jest.fn()} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("reflects checked state", () => {
    render(<ToggleSwitch checked={true} onChange={jest.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onChange when toggled", () => {
    const onChange = jest.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("applies label as aria-label", () => {
    render(<ToggleSwitch checked={false} onChange={jest.fn()} label="Dark mode" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-label", "Dark mode");
  });

  it("defaults aria-label to Toggle", () => {
    render(<ToggleSwitch checked={false} onChange={jest.fn()} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-label", "Toggle");
  });

  it("disables the input when disabled is true", () => {
    render(<ToggleSwitch checked={false} onChange={jest.fn()} disabled />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
