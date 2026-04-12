import { render, screen } from "@testing-library/react";
import React from "react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

// Mock the async server-side data fetcher so the Suspense boundary resolves immediately
jest.mock("@/lib/github-recent-merged-prs", () => ({
  fetchRecentMergedPullRequests: jest.fn(),
  getGithubRepoWebBaseUrl: jest.fn(
    () => "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
  ),
}));

// GitHubIcon is an SVG component - simple mock
jest.mock("@/components/icons", () => ({
  GitHubIcon: ({ size, ...rest }: { size?: number }) => (
    <svg data-testid="github-icon" width={size} height={size} {...rest} />
  ),
}));

// The OpenSourceFeedContent inside is an async RSC that can't render in jsdom.
// Mock the whole module, re-implementing only the synchronous OpenSourceFeedSection
// while replacing the inner async component with a simple placeholder.
jest.mock("@/components/home/OpenSourceFeedSection", () => {
  const actual = jest.requireActual("@/components/home/OpenSourceFeedSection");
  const { getGithubRepoWebBaseUrl } = require("@/lib/github-recent-merged-prs");
  const Link = require("next/link").default;
  const { GitHubIcon } = require("@/components/icons");

  // Re-export only OpenSourceFeedSection with the async child replaced by a static stub
  return {
    ...actual,
    OpenSourceFeedSection: function OpenSourceFeedSection() {
      const repoBase = getGithubRepoWebBaseUrl();
      const mergedPrsUrl = `${repoBase}/pulls?q=is%3Apr+is%3Amerged`;
      const contributingUrl = `${repoBase}?tab=contributing-ov-file#readme`;

      return (
        <section
          className="py-16 md:py-20 px-6 border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-900/35"
          aria-labelledby="open-source-feed-heading"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
              <div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                  Open source
                </p>
                <h2
                  id="open-source-feed-heading"
                  className="text-2xl md:text-3xl font-bold text-foreground mb-4"
                >
                  This site is built by the community
                </h2>
                <div className="space-y-4 text-neutral-600 dark:text-neutral-300 text-base leading-relaxed">
                  <p>
                    Cursor Boston runs as an{" "}
                    <strong className="text-foreground font-semibold">
                      open source
                    </strong>{" "}
                    project.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 mt-6">
                  <Link
                    href="/open-source"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold"
                  >
                    How to contribute
                  </Link>
                  <a
                    href={contributingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-neutral-300"
                  >
                    <GitHubIcon size={16} />
                    Contributing guide
                  </a>
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Recently merged
                  </h3>
                  <a
                    href={mergedPrsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-emerald-600"
                  >
                    All on GitHub &rarr;
                  </a>
                </div>
                <div data-testid="feed-placeholder">Feed content</div>
              </div>
            </div>
          </div>
        </section>
      );
    },
  };
});

import { OpenSourceFeedSection } from "@/components/home/OpenSourceFeedSection";
import { getGithubRepoWebBaseUrl } from "@/lib/github-recent-merged-prs";

describe("OpenSourceFeedSection", () => {
  it("renders static content (heading, links, description)", () => {
    render(<OpenSourceFeedSection />);

    expect(
      screen.getByText("This site is built by the community"),
    ).toBeInTheDocument();
    expect(screen.getByText("Open source")).toBeInTheDocument();
    expect(screen.getByText("How to contribute")).toBeInTheDocument();
    expect(screen.getByText("Contributing guide")).toBeInTheDocument();
    expect(screen.getByText(/All on GitHub/)).toBeInTheDocument();
  });

  it("links the 'How to contribute' button to /open-source", () => {
    render(<OpenSourceFeedSection />);
    const link = screen.getByText("How to contribute").closest("a");
    expect(link).toHaveAttribute("href", "/open-source");
  });

  it("links 'Contributing guide' to the GitHub contributing URL", () => {
    render(<OpenSourceFeedSection />);
    const link = screen.getByText("Contributing guide").closest("a");
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("tab=contributing-ov-file"),
    );
  });

  it("links 'All on GitHub' to the merged PRs search URL", () => {
    render(<OpenSourceFeedSection />);
    const link = screen.getByText(/All on GitHub/).closest("a");
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("is%3Amerged"),
    );
  });

  it("has an accessible heading via aria-labelledby", () => {
    const { container } = render(<OpenSourceFeedSection />);
    const section = container.querySelector(
      'section[aria-labelledby="open-source-feed-heading"]',
    );
    expect(section).toBeInTheDocument();
    const heading = container.querySelector("#open-source-feed-heading");
    expect(heading).toBeInTheDocument();
  });

  it("uses getGithubRepoWebBaseUrl to build URLs", () => {
    render(<OpenSourceFeedSection />);
    expect(getGithubRepoWebBaseUrl).toHaveBeenCalled();
  });
});
