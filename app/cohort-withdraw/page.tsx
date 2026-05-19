/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cohort 1 withdrawal - Cursor Boston",
  description: "Confirm your withdrawal from Cursor Boston Cohort 1.",
};

export default async function CohortWithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <div className="flex flex-col">
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-xl mx-auto text-center">
          {status === "success" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                You&apos;ve withdrawn from Cohort 1
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Your spot will be freed up for the waitlist. If this was a
                mistake or you change your mind, email{" "}
                <a
                  href="mailto:roger@cursorboston.com"
                  className="underline"
                >
                  roger@cursorboston.com
                </a>{" "}
                — we can put you back in.
              </p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Invalid link
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                This withdrawal link is invalid or has been tampered with. If
                you meant to withdraw, email{" "}
                <a
                  href="mailto:roger@cursorboston.com"
                  className="underline"
                >
                  roger@cursorboston.com
                </a>{" "}
                directly.
              </p>
            </>
          )}
          {status === "rate-limited" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Too many requests
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Please wait a few minutes and try again.
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Something went wrong
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                We couldn&apos;t process your withdrawal. Please try again or
                email{" "}
                <a
                  href="mailto:roger@cursorboston.com"
                  className="underline"
                >
                  roger@cursorboston.com
                </a>
                .
              </p>
            </>
          )}
          {!status && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Cohort 1 withdrawal
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Use the link in your email to withdraw from Cohort 1.
              </p>
            </>
          )}
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-foreground transition-colors"
          >
            &larr; Back to cursorboston.com
          </Link>
        </div>
      </section>
    </div>
  );
}
