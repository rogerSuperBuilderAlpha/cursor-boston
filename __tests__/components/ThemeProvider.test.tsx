import { render, screen } from "@testing-library/react";

jest.mock("next-themes", () => ({
  ThemeProvider: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="theme-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));

import { ThemeProvider } from "@/components/ThemeProvider";

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <span>Hello</span>
      </ThemeProvider>
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("passes props through to the underlying provider", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <span>Content</span>
      </ThemeProvider>
    );
    const provider = screen.getByTestId("theme-provider");
    const props = JSON.parse(provider.getAttribute("data-props") || "{}");
    expect(props.attribute).toBe("class");
    expect(props.defaultTheme).toBe("dark");
  });
});
