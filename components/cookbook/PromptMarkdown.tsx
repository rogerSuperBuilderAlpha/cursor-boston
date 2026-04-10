/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import type { Components } from "react-markdown";

/** Renders sanitized markdown content with syntax highlighting and theme-aware styling. */
export function PromptMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const components: Components = {
    p: ({ children }) => (
      <div className="mb-2 last:mb-0 text-sm text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-sm text-neutral-700 dark:text-neutral-300">{children}</li>
    ),
    h1: ({ children }) => (
      <h1 className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-sm font-bold mt-2 mb-1 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
    ),
    code: ({ className: codeClassName, children, ...props }) => {
      const isInline = !codeClassName;
      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      const match = /language-(\w+)/.exec(codeClassName || "");
      const lang = match ? match[1] : "text";
      const raw = Array.isArray(children) ? children.join("") : String(children ?? "");
      return (
        <SyntaxHighlighter
          language={lang}
          style={isDark ? oneDark : oneLight}
          PreTag="div"
          customStyle={{
            margin: 0,
            marginTop: "0.5rem",
            marginBottom: "0.5rem",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
          }}
          codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
          showLineNumbers={false}
          wrapLongLines
        >
          {raw}
        </SyntaxHighlighter>
      );
    },
    pre: ({ children }) => <>{children}</>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-600 pl-3 my-1 text-neutral-600 dark:text-neutral-400 text-sm">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
