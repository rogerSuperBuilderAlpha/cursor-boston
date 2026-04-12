import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Avatar from "@/components/Avatar";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, priority, onError, ...rest } = props;
    return (
      // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
      <img
        data-fill={fill ? "true" : undefined}
        onClick={() => {
          // simulate error for testing fallback
          if (typeof onError === "function") (onError as () => void)();
        }}
        {...rest}
      />
    );
  },
}));

describe("Avatar", () => {
  it("renders image when src is provided", () => {
    render(<Avatar src="/photo.jpg" name="Alice" />);
    const img = screen.getByAltText("Alice");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/photo.jpg");
  });

  it("renders initials when no src", () => {
    render(<Avatar name="Alice Baker" />);
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("renders single initial for single name", () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to email initial when no name", () => {
    render(<Avatar email="bob@test.com" />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows ? when no name and no email", () => {
    render(<Avatar />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("falls back to initials on image error", () => {
    render(<Avatar src="/broken.jpg" name="Charlie Delta" />);
    const img = screen.getByAltText("Charlie Delta");
    // Simulate the error by clicking (our mock triggers onError on click)
    fireEvent.click(img);
    expect(screen.getByText("CD")).toBeInTheDocument();
  });

  it("applies the correct size class for sm", () => {
    const { container } = render(<Avatar name="X" size="sm" />);
    const el = container.firstElementChild;
    expect(el?.className).toContain("w-8");
  });

  it("applies the correct size class for lg", () => {
    const { container } = render(<Avatar name="X" size="lg" />);
    const el = container.firstElementChild;
    expect(el?.className).toContain("w-16");
  });

  it("defaults to xl size", () => {
    const { container } = render(<Avatar name="X" />);
    const el = container.firstElementChild;
    expect(el?.className).toContain("w-24");
  });

  it("applies custom className", () => {
    const { container } = render(<Avatar name="X" className="my-custom" />);
    const el = container.firstElementChild;
    expect(el?.className).toContain("my-custom");
  });

  it("sets aria-label on fallback avatar", () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByRole("img", { name: "Alice" })).toBeInTheDocument();
  });

  it("uses email for aria-label when no name", () => {
    render(<Avatar email="test@x.com" />);
    expect(screen.getByRole("img", { name: "test@x.com" })).toBeInTheDocument();
  });
});
