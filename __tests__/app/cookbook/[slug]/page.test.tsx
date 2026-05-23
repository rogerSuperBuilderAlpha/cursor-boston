/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ content }: { content: string }) => (
    <pre data-testid="prompt-markdown">{content}</pre>
  ),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockNotFound = notFound as jest.MockedFunction<typeof notFound>;

function makeDoc(data: Record<string, unknown> | undefined) {
  return {
    id: "entry-1",
    exists: data !== undefined,
    data: () => data,
  };
}

function installEntry(data: Record<string, unknown> | undefined) {
  mockGetAdminDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(makeDoc(data)),
      })),
    })),
  } as never);
}

const entryData = {
  title: "Review React render paths",
  description: "A prompt for finding expensive React render work.",
  promptContent: "Find avoidable rerenders and suggest measured fixes.",
  category: "performance",
  tags: ["react", "profiling"],
  worksWith: ["React", "TypeScript"],
  authorId: "user-1",
  authorDisplayName: "Ada",
  createdAt: { toMillis: () => Date.parse("2026-05-01T00:00:00.000Z") },
  upCount: 7,
  downCount: 2,
  seo: {
    title: "React Render Review Prompt",
    description: "Find expensive render paths with this Cursor prompt.",
    image: "/showcase/react-review.png",
  },
};

describe("cookbook entry page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installEntry(entryData);
  });

  it("generateMetadata returns title, canonical, and social preview data", async () => {
    const { generateMetadata } = await import("@/app/cookbook/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "entry-1" }),
    });

    expect(meta.title).toBe("React Render Review Prompt");
    expect(meta.description).toBe(
      "Find expensive render paths with this Cursor prompt.",
    );
    expect(meta.alternates?.canonical).toBe(
      "https://cursorboston.com/cookbook/entry-1",
    );
    expect(meta.openGraph?.images).toEqual([
      {
        url: "https://cursorboston.com/showcase/react-review.png",
        width: 1200,
        height: 630,
        alt: "Review React render paths",
      },
    ]);
  });

  it("renders the entry page with CreativeWork JSON-LD", async () => {
    const Page = (await import("@/app/cookbook/[slug]/page")).default;

    const ui = await Page({ params: Promise.resolve({ slug: "entry-1" }) });
    const { container } = render(ui);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Review React render paths",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-markdown")).toHaveTextContent(
      "Find avoidable rerenders",
    );
    expect(screen.getByRole("link", { name: "#react" })).toHaveAttribute(
      "href",
      "/cookbook?search=react",
    );

    const jsonLd = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLd?.textContent).toContain('"@type":"CreativeWork"');
    expect(jsonLd?.textContent).toContain('"keywords":"react, profiling, React, TypeScript"');
  });

  it("returns not-found metadata and calls notFound for missing entries", async () => {
    installEntry(undefined);
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    const pageModule = await import("@/app/cookbook/[slug]/page");
    await expect(
      pageModule.generateMetadata({
        params: Promise.resolve({ slug: "missing" }),
      }),
    ).resolves.toEqual({ title: "Cookbook Entry Not Found" });

    await expect(
      pageModule.default({ params: Promise.resolve({ slug: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});
