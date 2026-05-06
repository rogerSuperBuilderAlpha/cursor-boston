import React from "react";
import { render, screen } from "@testing-library/react";
import { ValidatedInput } from "@/components/ui/ValidatedInput";

describe("ValidatedInput", () => {
  it("connects the label to the input", () => {
    render(<ValidatedInput id="email" label="Email" />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email");
  });

  it("connects helper text and error text with aria-describedby", () => {
    render(
      <ValidatedInput
        id="password"
        label="Password"
        helperText="Use at least 8 characters."
        error="Password is too short"
      />,
    );

    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-describedby",
      "password-helper password-error",
    );
    expect(screen.getByText("Use at least 8 characters.")).toHaveAttribute("id", "password-helper");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "password-error");
  });

  it("marks the input invalid only when an error is present", () => {
    const { rerender } = render(<ValidatedInput id="name" label="Name" />);

    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");

    rerender(<ValidatedInput id="name" label="Name" error="Name is required" />);

    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("preserves caller-provided aria-describedby values", () => {
    render(
      <ValidatedInput
        id="email"
        label="Email"
        aria-describedby="form-error"
        error="Please enter a valid email"
      />,
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "form-error email-error",
    );
  });

  it("keeps computed accessibility attributes authoritative", () => {
    render(
      <ValidatedInput
        id="email"
        label="Email"
        aria-describedby="form-error"
        aria-invalid={false}
        error="Please enter a valid email"
      />,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-describedby", "form-error email-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("passes through standard input props", () => {
    render(<ValidatedInput id="email" label="Email" type="email" placeholder="you@example.com" required />);

    const input = screen.getByPlaceholderText("you@example.com");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
  });
});
