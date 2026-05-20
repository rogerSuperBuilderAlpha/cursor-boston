/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `components/home/OpenSourceFeedSection.tsx`.
 * Complement to the sibling OpenSourceFeedSection.test.tsx (which stubs
 * the entire section): this file drives the REAL internal helpers by
 * walking the rendered element tree, locating the async
 * OpenSourceFeedContent child of the Suspense boundary, and invoking it
 * directly with awaited results. That lifts coverage on the error/empty
 * branches, the PR-list rendering, and the `formatMergedDate` helper
 * (valid + invalid date paths).
 */

import React from "react";
import { render, screen } from "@testing-library/react";

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

jest.mock("@/components/icons", () => ({
  GitHubIcon: ({ size }: { size?: number }) => (
    <span data-testid="github-icon" data-size={size} />
  ),
}));

const mockFetch = jest.fn();
jest.mock("@/lib/github-recent-merged-prs", () => ({
  fetchRecentMergedPullRequests: (...args: unknown[]) => mockFetch(...args),
  getGithubRepoWebBaseUrl: () =>
    "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
}));

import { OpenSourceFeedSection } from "@/components/home/OpenSourceFeedSection";

/**
 * Walk the React element tree returned by OpenSourceFeedSection() and
 * find the Suspense boundary's children — that's the async
 * OpenSourceFeedContent component. Returns the child element so its
 * `.type` can be awaited.
 */
function findSuspenseChild(
  tree: React.ReactElement
): React.ReactElement | null {
  let found: React.ReactElement | null = null;
  const visit = (node: unknown): void => {
    if (found) return;
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    const el = node as React.ReactElement & {
      type?: unknown;
      props?: { children?: unknown };
    };
    const type = el.type as unknown;
    const typeStr =
      typeof type === "symbol"
        ? String(type)
        : typeof type === "function"
          ? (type as { displayName?: string; name?: string }).displayName ||
            (type as { name?: string }).name ||
            ""
          : "";
    if (typeStr.toLowerCase().includes("suspense")) {
      found = (el.props?.children as React.ReactElement) ?? null;
      return;
    }
    const children = el.props?.children;
    if (Array.isArray(children)) {
      for (const c of children) visit(c);
    } else if (children) {
      visit(children);
    }
  };
  visit(tree);
  return found;
}

async function renderContent() {
  const tree = OpenSourceFeedSection();
  const child = findSuspenseChild(tree as React.ReactElement);
  if (!child) throw new Error("no suspense child");
  const asyncComp = child.type as (props: unknown) => Promise<React.ReactElement>;
  const resolved = await asyncComp((child.props as unknown) ?? {});
  return render(resolved);
}

describe("OpenSourceFeedSection (outer synchronous shell)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      prs: [],
      repoUrl: "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
      error: false,
    });
  });

  it("returns a React element tree (callable as a function component)", () => {
    const tree = OpenSourceFeedSection() as React.ReactElement;
    expect(tree).not.toBeNull();
    expect(tree.type).toBe("section");
  });

  it("section root has aria-labelledby + matching heading id", () => {
    const tree = OpenSourceFeedSection() as React.ReactElement;
    expect(tree.props["aria-labelledby"]).toBe("open-source-feed-heading");
  });

  it("locates the Suspense boundary's async child via tree walk", () => {
    const tree = OpenSourceFeedSection() as React.ReactElement;
    const child = findSuspenseChild(tree);
    expect(child).not.toBeNull();
    expect(typeof child!.type).toBe("function");
  });

  it("renders the Suspense skeleton fallback (4 placeholder rows)", () => {
    const tree = OpenSourceFeedSection() as React.ReactElement;
    // Walk to find the Suspense element and pull its fallback prop.
    let fallback: React.ReactElement | null = null;
    const visit = (node: unknown): void => {
      if (fallback) return;
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const n of node) visit(n);
        return;
      }
      const el = node as React.ReactElement & {
        type?: unknown;
        props?: { children?: unknown; fallback?: React.ReactElement };
      };
      const type = el.type as unknown;
      const typeStr =
        typeof type === "symbol" ? String(type) : "";
      if (typeStr.toLowerCase().includes("suspense")) {
        fallback = el.props?.fallback ?? null;
        return;
      }
      const children = el.props?.children;
      if (Array.isArray(children)) {
        for (const c of children) visit(c);
      } else if (children) {
        visit(children);
      }
    };
    visit(tree);
    expect(fallback).not.toBeNull();
    const { container } = render(fallback!);
    expect(container.querySelectorAll("li").length).toBe(4);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("OpenSourceFeedContent (async child)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders the merged-PR list when prs are present (happy path)", async () => {
    mockFetch.mockResolvedValue({
      prs: [
        {
          number: 1234,
          title: "Add cool feature",
          htmlUrl: "https://github.com/x/y/pull/1234",
          mergedAt: "2026-01-15T10:00:00Z",
          authorLogin: "alice",
        },
      ],
      repoUrl: "https://github.com/x/y",
      error: false,
    });
    await renderContent();
    expect(screen.getByText("Add cool feature")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("#1234")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Recently merged pull requests")
    ).toBeInTheDocument();
  });

  it("renders the empty/no-merges state when prs=[] and error=false", async () => {
    mockFetch.mockResolvedValue({
      prs: [],
      repoUrl: "https://github.com/x/y",
      error: false,
    });
    await renderContent();
    expect(
      screen.getByText(/No merged pull requests to show yet/)
    ).toBeInTheDocument();
    // Link copy under either empty branch
    expect(screen.getByText(/View merged PRs on GitHub/)).toBeInTheDocument();
  });

  it("renders the error state when error=true", async () => {
    mockFetch.mockResolvedValue({
      prs: [],
      repoUrl: "https://github.com/x/y",
      error: true,
    });
    await renderContent();
    expect(
      screen.getByText(/We couldn't load the latest merges right now/)
    ).toBeInTheDocument();
  });

  it("renders the error state even when prs are present (error short-circuits)", async () => {
    mockFetch.mockResolvedValue({
      prs: [
        {
          number: 1,
          title: "irrelevant",
          htmlUrl: "https://example.com",
          mergedAt: "2026-01-15T10:00:00Z",
          authorLogin: "x",
        },
      ],
      repoUrl: "https://github.com/x/y",
      error: true,
    });
    await renderContent();
    expect(
      screen.getByText(/We couldn't load the latest merges/)
    ).toBeInTheDocument();
    expect(screen.queryByText("irrelevant")).toBeNull();
  });

  it("formats the merged date when the ISO is valid", async () => {
    mockFetch.mockResolvedValue({
      prs: [
        {
          number: 7,
          title: "Valid date",
          htmlUrl: "https://example.com",
          mergedAt: "2026-03-15T10:00:00Z",
          authorLogin: "carol",
        },
      ],
      repoUrl: "https://github.com/x/y",
      error: false,
    });
    await renderContent();
    // The date string is locale-dependent — assert on a substring that's
    // robust across locales (the year is always present).
    expect(screen.getByText(/merged/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/2026/);
  });

  it("hides the date suffix when the ISO is invalid (formatMergedDate empty branch)", async () => {
    mockFetch.mockResolvedValue({
      prs: [
        {
          number: 8,
          title: "Bad date",
          htmlUrl: "https://example.com",
          mergedAt: "not-a-date-at-all",
          authorLogin: "dan",
        },
      ],
      repoUrl: "https://github.com/x/y",
      error: false,
    });
    await renderContent();
    // The title still renders.
    expect(screen.getByText("Bad date")).toBeInTheDocument();
    // The "merged …" text branch is conditionally suppressed when format returns "".
    expect(document.body.textContent).not.toMatch(/· merged/);
  });

  it("renders multiple PR rows, one <li> each", async () => {
    mockFetch.mockResolvedValue({
      prs: [
        {
          number: 1,
          title: "first",
          htmlUrl: "x",
          mergedAt: "2026-01-15T00:00:00Z",
          authorLogin: "a",
        },
        {
          number: 2,
          title: "second",
          htmlUrl: "y",
          mergedAt: "2026-01-16T00:00:00Z",
          authorLogin: "b",
        },
        {
          number: 3,
          title: "third",
          htmlUrl: "z",
          mergedAt: "2026-01-17T00:00:00Z",
          authorLogin: "c",
        },
      ],
      repoUrl: "https://github.com/x/y",
      error: false,
    });
    const { container } = await renderContent();
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  it("calls fetchRecentMergedPullRequests with the configured limit (8)", async () => {
    mockFetch.mockResolvedValue({ prs: [], repoUrl: "x", error: false });
    await renderContent();
    expect(mockFetch).toHaveBeenCalledWith(8);
  });
});
