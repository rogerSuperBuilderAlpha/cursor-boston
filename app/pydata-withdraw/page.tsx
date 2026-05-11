/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import Link from "next/link";

import { verifyPydataWithdrawToken } from "@/lib/unsubscribe-token";

export const metadata: Metadata = {
  title: "PyData May 13 withdrawal - Cursor Boston",
  description: "Confirm your withdrawal from the May 13 PyData Data Science Hack.",
};

export const dynamic = "force-dynamic";

// Mask the local part of an email for display so a forwarded link doesn't leak
// the recipient's full address — keep enough chars to recognize your own.
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 3) return local[0] + "***" + domain;
  return local.slice(0, 2) + "***" + local.slice(-1) + domain;
}

export default async function PydataWithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string; token?: string }>;
}) {
  const { status, email: rawEmail, token } = await searchParams;
  const email = rawEmail?.toLowerCase().trim() ?? "";

  if (status === "success") {
    return (
      <Shell>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          You&apos;ve withdrawn from PyData May 13
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          Thanks for letting us know — we&apos;ll release your seat to someone on
          the waitlist. If this was a mistake, email{" "}
          <a href="mailto:roger@cursorboston.com" className="underline">
            roger@cursorboston.com
          </a>{" "}
          and we&apos;ll put you back in if there&apos;s still room.
        </p>
        <BackLink />
      </Shell>
    );
  }

  if (status === "invalid") {
    return (
      <Shell>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Invalid link
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          This withdrawal link is invalid or has been tampered with. If you
          meant to withdraw, email{" "}
          <a href="mailto:roger@cursorboston.com" className="underline">
            roger@cursorboston.com
          </a>{" "}
          directly.
        </p>
        <BackLink />
      </Shell>
    );
  }

  if (status === "rate-limited") {
    return (
      <Shell>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Too many requests
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          Please wait a few minutes and try again.
        </p>
        <BackLink />
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Something went wrong
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          We couldn&apos;t process your withdrawal. Please try again or email{" "}
          <a href="mailto:roger@cursorboston.com" className="underline">
            roger@cursorboston.com
          </a>
          .
        </p>
        <BackLink />
      </Shell>
    );
  }

  // Default state: confirmation. Verify signature before rendering the
  // "Confirm withdrawal" button — bad tokens look identical to status=invalid.
  if (!email || !token || !verifyPydataWithdrawToken(email, token)) {
    return (
      <Shell>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Invalid link
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          This withdrawal link is invalid or has been tampered with. If you
          meant to withdraw, email{" "}
          <a href="mailto:roger@cursorboston.com" className="underline">
            roger@cursorboston.com
          </a>{" "}
          directly.
        </p>
        <BackLink />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
        Withdraw from PyData May 13?
      </h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-2">
        You&apos;re about to withdraw{" "}
        <span className="font-medium text-foreground">{maskEmail(email)}</span>{" "}
        from the Cursor Boston × PyData Data Science Hack on Wednesday, May 13
        at Moderna HQ.
      </p>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8">
        We&apos;ll mark your seat as available and give it to someone on the
        waitlist. This can&apos;t be undone with one click — if you change your
        mind, email{" "}
        <a href="mailto:roger@cursorboston.com" className="underline">
          roger@cursorboston.com
        </a>
        .
      </p>
      <form
        method="POST"
        action="/api/events/pydata-2026/withdraw"
        className="flex flex-col sm:flex-row gap-3 items-center justify-center"
      >
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          Yes, withdraw me
        </button>
        <Link
          href="/events/cursor-boston-pydata-2026/register"
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-6 py-3 text-sm font-semibold text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Never mind, keep my spot
        </Link>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-xl mx-auto text-center">{children}</div>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="text-sm text-neutral-500 hover:text-foreground transition-colors"
    >
      &larr; Back to cursorboston.com
    </Link>
  );
}
