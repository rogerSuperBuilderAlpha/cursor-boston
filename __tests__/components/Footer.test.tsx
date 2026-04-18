import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img data-fill={fill ? "true" : undefined} data-priority={priority ? "true" : undefined} {...rest} />;
  },
}));

describe("Footer", () => {
  it("renders footer landmark", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("renders all four link column headings", () => {
    render(<Footer />);
    for (const heading of ["Site", "Community", "Cursor", "Legal"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("renders site navigation links with correct hrefs", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "Talks" })).toHaveAttribute("href", "/talks");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  });

  it("renders legal links", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Code of Conduct" })).toHaveAttribute("href", "/code-of-conduct");
    expect(screen.getByRole("link", { name: "Accessibility" })).toHaveAttribute("href", "/accessibility");
    expect(screen.getByRole("link", { name: "Disclaimer" })).toHaveAttribute("href", "/disclaimer");
  });

  it("renders external links with target _blank", () => {
    render(<Footer />);
    const discordLinks = screen.getAllByRole("link", { name: /discord/i });
    for (const link of discordLinks) {
      if (link.getAttribute("href")?.startsWith("http")) {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      }
    }
  });

  it("renders the current copyright year", () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument();
  });

  it("renders contact email link", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "hello@cursorboston.com" })).toHaveAttribute(
      "href",
      "mailto:hello@cursorboston.com"
    );
  });

  it("renders the Gauntlet sponsor section", () => {
    render(<Footer />);
    expect(screen.getByText(/Gauntlet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gauntlet/i })).toHaveAttribute("target", "_blank");
  });
});
