import React from "react";
import { render, screen } from "@testing-library/react";
import Logo from "@/components/Logo";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return (
      // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
      <img
        data-fill={fill ? "true" : undefined}
        data-priority={priority ? "true" : undefined}
        {...rest}
      />
    );
  },
}));

describe("Logo", () => {
  it("renders without crashing", () => {
    render(<Logo size="sm" />);
    expect(screen.getByAltText("Cursor Boston")).toBeInTheDocument();
  });

  it("renders the correct image src", () => {
    render(<Logo size="sm" />);
    const img = screen.getByAltText("Cursor Boston");
    expect(img).toHaveAttribute("src", "/cursor-boston-logo.png");
  });

  it("applies sm size class", () => {
    const { container } = render(<Logo size="sm" />);
    expect(container.firstElementChild?.className).toContain("w-8");
    expect(container.firstElementChild?.className).toContain("h-8");
  });

  it("applies header size class", () => {
    const { container } = render(<Logo size="header" />);
    expect(container.firstElementChild?.className).toContain("w-12");
    expect(container.firstElementChild?.className).toContain("h-12");
  });

  it("applies hero size class", () => {
    const { container } = render(<Logo size="hero" />);
    expect(container.firstElementChild?.className).toContain("w-28");
    expect(container.firstElementChild?.className).toContain("h-28");
  });

  it("applies heroHome size class", () => {
    const { container } = render(<Logo size="heroHome" />);
    expect(container.firstElementChild?.className).toContain("w-40");
  });

  it("applies custom className", () => {
    const { container } = render(<Logo size="sm" className="extra" />);
    expect(container.firstElementChild?.className).toContain("extra");
  });

  it("sets fill attribute on the image", () => {
    render(<Logo size="sm" />);
    const img = screen.getByAltText("Cursor Boston");
    expect(img).toHaveAttribute("data-fill", "true");
  });

  it("forwards priority to the image when true", () => {
    render(<Logo size="sm" priority />);
    const img = screen.getByAltText("Cursor Boston");
    expect(img).toHaveAttribute("data-priority", "true");
  });

  it("does not set priority when false", () => {
    render(<Logo size="sm" />);
    const img = screen.getByAltText("Cursor Boston");
    expect(img).not.toHaveAttribute("data-priority");
  });
});
