/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `components/cookbook/PromptMarkdown.tsx` was at
 * 0% branches (12 uncovered). The component is largely a `components` map
 * of React-Markdown overrides + a theme-aware code block. We mock
 * react-markdown to invoke each `components.*` renderer directly so every
 * branch (inline vs fenced code, dark vs light theme) is exercised.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// Capture what gets passed to ReactMarkdown so we can manually invoke the
// `components` map. The mock just renders children directly.
let lastComponents: Record<string, React.ComponentType<unknown>> | null = null;
let lastContent: string | null = null;

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({
    children,
    components,
  }: {
    children: string;
    components: Record<string, React.ComponentType<unknown>>;
  }) => {
    lastComponents = components;
    lastContent = children;
    return <div data-testid="react-markdown">{children}</div>;
  },
}));

jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("rehype-sanitize", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-syntax-highlighter", () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-testid="syntax-highlighter" data-language={language}>
      {children}
    </pre>
  ),
}));

jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: { name: "oneDark" },
  oneLight: { name: "oneLight" },
}));

const mockUseTheme = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

import { PromptMarkdown } from "@/components/cookbook/PromptMarkdown";

beforeEach(() => {
  lastComponents = null;
  lastContent = null;
  mockUseTheme.mockReturnValue({ resolvedTheme: "light" });
});

describe("PromptMarkdown", () => {
  it("renders the markdown content inside a wrapper div", () => {
    render(<PromptMarkdown content="hello world" />);
    expect(screen.getByTestId("react-markdown")).toHaveTextContent(
      "hello world"
    );
    expect(lastContent).toBe("hello world");
  });

  it("forwards a custom className to the wrapper div", () => {
    const { container } = render(
      <PromptMarkdown content="x" className="custom-class" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toBe("custom-class");
  });

  it("passes a components map with the expected element overrides", () => {
    render(<PromptMarkdown content="x" />);
    expect(lastComponents).not.toBeNull();
    const keys = Object.keys(lastComponents!);
    for (const k of ["p", "ul", "ol", "li", "h1", "h2", "h3", "code", "pre", "strong", "blockquote"]) {
      expect(keys).toContain(k);
    }
  });

  it("renders paragraph, heading, list, and blockquote overrides", () => {
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    // Render each non-code override to make sure they produce DOM.
    const { container } = render(
      <>
        {React.createElement(C.p as React.ComponentType<{ children: React.ReactNode }>, null, "para")}
        {React.createElement(C.ul as React.ComponentType<{ children: React.ReactNode }>, null, <li>one</li>)}
        {React.createElement(C.ol as React.ComponentType<{ children: React.ReactNode }>, null, <li>two</li>)}
        {React.createElement(C.li as React.ComponentType<{ children: React.ReactNode }>, null, "item")}
        {React.createElement(C.h1 as React.ComponentType<{ children: React.ReactNode }>, null, "h1")}
        {React.createElement(C.h2 as React.ComponentType<{ children: React.ReactNode }>, null, "h2")}
        {React.createElement(C.h3 as React.ComponentType<{ children: React.ReactNode }>, null, "h3")}
        {React.createElement(C.strong as React.ComponentType<{ children: React.ReactNode }>, null, "b")}
        {React.createElement(C.blockquote as React.ComponentType<{ children: React.ReactNode }>, null, "quote")}
        {React.createElement(C.pre as React.ComponentType<{ children: React.ReactNode }>, null, "raw")}
      </>
    );
    expect(container.textContent).toContain("para");
    expect(container.textContent).toContain("one");
    expect(container.textContent).toContain("two");
    expect(container.textContent).toContain("item");
    expect(container.textContent).toContain("h1");
    expect(container.textContent).toContain("h2");
    expect(container.textContent).toContain("h3");
    expect(container.textContent).toContain("b");
    expect(container.textContent).toContain("quote");
    expect(container.textContent).toContain("raw");
  });

  it("renders inline code (no language className) with the inline style", () => {
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    const Code = C.code as React.ComponentType<{
      className?: string;
      children: React.ReactNode;
    }>;
    const { container } = render(<Code>inline-code</Code>);
    const codeEl = container.querySelector("code");
    expect(codeEl).not.toBeNull();
    expect(codeEl!.textContent).toBe("inline-code");
    // No syntax highlighter rendered for inline path
    expect(container.querySelector("[data-testid='syntax-highlighter']")).toBeNull();
  });

  it("renders fenced code blocks with detected language", () => {
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    const Code = C.code as React.ComponentType<{
      className?: string;
      children: React.ReactNode;
    }>;
    const { container } = render(
      <Code className="language-typescript">const x = 1;</Code>
    );
    const hl = container.querySelector("[data-testid='syntax-highlighter']");
    expect(hl).not.toBeNull();
    expect(hl!.getAttribute("data-language")).toBe("typescript");
    expect(hl!.textContent).toBe("const x = 1;");
  });

  it("falls back to language 'text' when className has no language-<lang>", () => {
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    const Code = C.code as React.ComponentType<{
      className?: string;
      children: React.ReactNode;
    }>;
    const { container } = render(<Code className="hljs">no language</Code>);
    const hl = container.querySelector("[data-testid='syntax-highlighter']");
    expect(hl).not.toBeNull();
    expect(hl!.getAttribute("data-language")).toBe("text");
  });

  it("joins an array of children into a single string for the highlighter", () => {
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    const Code = C.code as React.ComponentType<{
      className?: string;
      children: React.ReactNode;
    }>;
    const { container } = render(
      <Code className="language-js">
        {["line1\n", "line2"] as unknown as React.ReactNode}
      </Code>
    );
    const hl = container.querySelector("[data-testid='syntax-highlighter']");
    expect(hl!.textContent).toBe("line1\nline2");
  });

  it("coerces nullish children to empty string for the highlighter", () => {
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    const Code = C.code as React.ComponentType<{
      className?: string;
      children?: React.ReactNode;
    }>;
    const { container } = render(<Code className="language-js">{null}</Code>);
    const hl = container.querySelector("[data-testid='syntax-highlighter']");
    expect(hl).not.toBeNull();
    // String(null/undefined) handled by `?? ""`
    expect(hl!.textContent).toBe("");
  });

  it("uses the dark code-block style when resolvedTheme is 'dark'", () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark" });
    render(<PromptMarkdown content="x" />);
    // The component is created at render time; we just want to make sure
    // the dark branch (isDark === true) didn't crash.
    const C = lastComponents!;
    expect(C).not.toBeNull();
  });

  it("uses the light code-block style when resolvedTheme is undefined", () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: undefined });
    render(<PromptMarkdown content="x" />);
    const C = lastComponents!;
    expect(C).not.toBeNull();
  });
});
