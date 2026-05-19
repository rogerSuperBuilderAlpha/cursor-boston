/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import {
  getAllPostSlugs,
  getPostBySlug,
} from "@/lib/blog";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => require("react").createElement("a", { href }, children),
}));

jest.mock("@/lib/blog", () => ({
  getAllPostSlugs: jest.fn(),
  getPostBySlug: jest.fn(),
}));

const mockGetPostBySlug = getPostBySlug as jest.MockedFunction<typeof getPostBySlug>;
const mockGetAllPostSlugs = getAllPostSlugs as jest.MockedFunction<typeof getAllPostSlugs>;
const mockNotFound = notFound as jest.MockedFunction<typeof notFound>;

const samplePost = {
  slug: "sample-post",
  title: "Sample Post",
  excerpt: "A short excerpt",
  author: "Ada Lovelace",
  date: "2026-05-01",
  content: [
    "# Heading One",
    "## Heading Two",
    "### Heading Three",
    "---",
    "- Bullet **bold**",
    "1. Ordered [safe](https://example.com)",
    "Paragraph with `inline code` and [unsafe](javascript:alert(1)).",
  ].join("\n\n"),
};

describe("blog post page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllPostSlugs.mockReturnValue(["sample-post"]);
    mockGetPostBySlug.mockImplementation((slug: string) =>
      slug === "sample-post" ? samplePost : null,
    );
  });

  it("generateStaticParams maps slugs", async () => {
    const { generateStaticParams } = await import("@/app/blog/[slug]/page");
    await expect(generateStaticParams()).resolves.toEqual([
      { slug: "sample-post" },
    ]);
  });

  it("generateMetadata returns not-found title for missing posts", async () => {
    const { generateMetadata } = await import("@/app/blog/[slug]/page");
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(meta.title).toBe("Post Not Found");
  });

  it("generateMetadata includes canonical URL for existing posts", async () => {
    const { generateMetadata } = await import("@/app/blog/[slug]/page");
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "sample-post" }),
    });
    expect(meta.title).toBe(samplePost.title);
    expect(meta.alternates?.canonical).toBe(
      "https://cursorboston.com/blog/sample-post",
    );
  });

  it("calls notFound when the slug is unknown", async () => {
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    const Page = (await import("@/app/blog/[slug]/page")).default;
    await expect(
      Page({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders markdown content, JSON-LD, and CTA for a valid post", async () => {
    const Page = (await import("@/app/blog/[slug]/page")).default;
    const ui = await Page({ params: Promise.resolve({ slug: "sample-post" }) });
    const { container } = render(ui);

    expect(screen.getByRole("heading", { level: 1, name: "Sample Post" })).toBeInTheDocument();
    expect(screen.getByText("Heading One")).toBeInTheDocument();
    expect(screen.getByText("Heading Two")).toBeInTheDocument();
    expect(screen.getByText("Heading Three")).toBeInTheDocument();
    expect(screen.getByText(/Bullet/)).toBeInTheDocument();
    expect(screen.getByText(/Ordered/)).toBeInTheDocument();
    expect(screen.getByText(/inline code/)).toBeInTheDocument();

    const safeLink = screen.getByRole("link", { name: "safe" });
    expect(safeLink).toHaveAttribute("href", "https://example.com");
    const unsafeLink = screen.getByRole("link", { name: "unsafe" });
    expect(unsafeLink).toHaveAttribute("href", "#");

    const jsonLd = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLd?.textContent).toContain("BlogPosting");
    expect(screen.getByRole("link", { name: /Subscribe on Luma/i })).toHaveAttribute(
      "href",
      "https://lu.ma/cursor-boston",
    );
  });
});
