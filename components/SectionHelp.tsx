/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

export interface SectionHelpLink {
  label: string;
  href: string;
  external?: boolean;
}

interface Props {
  /** Short title like "About this section". */
  title: string;
  /** First-paragraph blurb shown without expanding. Plain text or React. */
  intro: React.ReactNode;
  /** Optional FAQ items shown inside the collapsed disclosure. */
  faq?: Array<{ q: string; a: React.ReactNode }>;
  /** Optional list of cross-links (docs, related pages, etc.). */
  links?: SectionHelpLink[];
  /** Whether the disclosure starts open. Default: false. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Inline help / introduction card for site sections. Renders a short
 * intro that's always visible, plus an optional disclosure with deeper
 * FAQ + cross-links. Drop one near the top of a page beneath the H1.
 */
export function SectionHelp({
  title,
  intro,
  faq,
  links,
  defaultOpen = false,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const hasMore = (faq && faq.length > 0) || (links && links.length > 0);

  return (
    <aside
      className={`mb-6 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 px-4 py-3 ${
        className ?? ""
      }`}
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <Info
          className="h-4 w-4 mt-0.5 text-blue-700 dark:text-blue-300 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            {title}
          </p>
          <div className="mt-1 text-sm leading-relaxed text-blue-900/90 dark:text-blue-100/90">
            {intro}
          </div>
          {hasMore && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-800 dark:text-blue-300 hover:underline"
                aria-expanded={open}
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {open ? "Show less" : "Learn more"}
              </button>
              {open && (
                <div className="mt-3 space-y-3 border-t border-blue-200/60 dark:border-blue-900/40 pt-3">
                  {faq && faq.length > 0 && (
                    <dl className="space-y-2.5">
                      {faq.map((item, i) => (
                        <div key={i}>
                          <dt className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            {item.q}
                          </dt>
                          <dd className="mt-0.5 text-sm text-blue-900/85 dark:text-blue-100/85">
                            {item.a}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {links && links.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {links.map((l, i) => (
                        <li key={i}>
                          {l.external ? (
                            <a
                              href={l.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 dark:text-blue-300 hover:underline"
                            >
                              {l.label} ↗
                            </a>
                          ) : (
                            <Link
                              href={l.href}
                              className="text-blue-700 dark:text-blue-300 hover:underline"
                            >
                              {l.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
