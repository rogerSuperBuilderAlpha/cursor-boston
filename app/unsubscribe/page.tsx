import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribe - Cursor Boston",
  description: "Manage your Cursor Boston email preferences.",
};

export default async function UnsubscribePage({
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
                You&apos;ve been unsubscribed
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                You won&apos;t receive any more event update emails from Cursor
                Boston. If you change your mind, just register for a future event
                on Luma and let us know.
              </p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Invalid link
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                This unsubscribe link is invalid or has already been used. If you
                need help, email{" "}
                <a
                  href="mailto:hello@cursorboston.com"
                  className="underline"
                >
                  hello@cursorboston.com
                </a>
                .
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
                We couldn&apos;t process your request. Please try again or email{" "}
                <a
                  href="mailto:hello@cursorboston.com"
                  className="underline"
                >
                  hello@cursorboston.com
                </a>
                .
              </p>
            </>
          )}
          {!status && (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Email preferences
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Use the link in your email to manage your subscription
                preferences.
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
