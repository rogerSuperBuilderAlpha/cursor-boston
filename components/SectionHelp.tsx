/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";

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
      className={cn(
        "mb-6 border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10",
        TW.radius.lg,
        TW.border.base,
        TW.spacing.px4,
        TW.spacing.py3,
        className
      )}
      aria-label={title}
    >
      <div className={cn(TW.layout.flex, TW.layout.itemsStart, TW.spacing.gap3)}>
        <Info
          className={cn(TW.sizing.iconSm, "mt-0.5 text-blue-700 dark:text-blue-300", TW.layout.shrink0)}
          aria-hidden="true"
        />
        <div className={cn(TW.layout.flex1, TW.layout.minW0)}>
          <p className={cn(TW.text.sm, TW.text.semibold, "text-blue-900 dark:text-blue-200")}>
            {title}
          </p>
          <div className={cn(TW.spacing.mt1, TW.text.sm, "leading-relaxed text-blue-900/90 dark:text-blue-100/90")}>
            {intro}
          </div>
          {hasMore && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(TW.spacing.mt2, TW.layout.inlineFlex, TW.layout.itemsCenter, TW.spacing.gap1, TW.text.tiny, TW.text.medium, "text-blue-800 dark:text-blue-300 hover:underline")}
                aria-expanded={open}
              >
                {open ? (
                  <ChevronDown className={TW.sizing.iconXs} aria-hidden="true" />
                ) : (
                  <ChevronRight className={TW.sizing.iconXs} aria-hidden="true" />
                )}
                {open ? "Show less" : "Learn more"}
              </button>
              {open && (
                <div className="mt-3 space-y-3 border-t border-blue-200/60 dark:border-blue-900/40 pt-3">
                  {faq && faq.length > 0 && (
                    <dl className="space-y-2.5">
                      {faq.map((item, i) => (
                        <div key={i}>
                          <dt className={cn(TW.text.sm, TW.text.medium, "text-blue-900 dark:text-blue-200")}>
                            {item.q}
                          </dt>
                          <dd className={cn("mt-0.5", TW.text.sm, "text-blue-900/85 dark:text-blue-100/85")}>
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
