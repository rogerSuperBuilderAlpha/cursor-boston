import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Affiliation Disclaimer",
  description:
    "Cursor Boston is an independent community organization. Learn about our relationship with Cursor and our partners.",
};

export default function DisclaimerPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Affiliation Disclaimer
          </h1>
          <p className="text-neutral-400">
            Understanding our relationship with Cursor and our community partners
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Independence Statement */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-8 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-400"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Cursor Boston is an Independent Organization
                </h2>
                <p className="text-neutral-300">
                  Cursor Boston is a community-driven organization that operates independently.
                  While we receive support from Cursor, we are <strong className="text-white">not
                  part of</strong> Cursor, Anysphere, or any affiliated corporate entity.
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="prose prose-invert prose-neutral">
            <h2 className="text-2xl font-bold text-white mb-4">Our Relationship with Cursor</h2>
            <p className="text-neutral-300 mb-6">
              Cursor Boston is part of the{" "}
              <a
                href="https://cursor.com/ambassadors"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Cursor Ambassadors Program
              </a>
              , a network of community leaders who help foster local communities of Cursor users
              around the world. This program provides us with resources and support to organize
              events and grow our community.
            </p>
            <p className="text-neutral-300 mb-6">
              However, it is important to understand that:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>
                Cursor Boston is <strong className="text-white">not owned, operated, or controlled</strong> by
                Cursor or Anysphere Inc.
              </li>
              <li>
                Our views, opinions, and content do <strong className="text-white">not represent</strong> the
                official positions of Cursor
              </li>
              <li>
                Cursor does not endorse or guarantee any content, events, or activities organized
                by Cursor Boston
              </li>
              <li>
                We operate as volunteers passionate about AI-powered development and building community
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">About Our Partners and Hosts</h2>
            <p className="text-neutral-300 mb-6">
              Cursor Boston collaborates with various venues, sponsors, and community partners to
              bring events and resources to our members. It is important to note:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>
                Event hosts and venue partners are <strong className="text-white">not official partners of Cursor</strong>
              </li>
              <li>
                Sponsors and partners support the <strong className="text-white">Cursor Boston community</strong>,
                not Cursor the company
              </li>
              <li>
                Any partnership or sponsorship with Cursor Boston does not imply a business
                relationship with Cursor or Anysphere Inc.
              </li>
              <li>
                Partner logos and mentions on our platform indicate support for our local community,
                not an endorsement by or affiliation with Cursor
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Trademark Notice</h2>
            <p className="text-neutral-300 mb-6">
              &quot;Cursor&quot; is a trademark of Anysphere Inc. Our use of the Cursor name in &quot;Cursor Boston&quot;
              is to identify our community of Cursor users in the Boston area and is used with
              permission through the Cursor Ambassadors Program. This use does not imply ownership,
              endorsement, or official affiliation beyond the ambassadors program.
            </p>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Learn More</h2>
            <p className="text-neutral-300 mb-6">
              To learn more about the official Cursor community initiatives and the Ambassadors
              Program, please visit:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <a
                href="https://cursor.com/ambassadors"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors"
              >
                Cursor Ambassadors Program
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
              <a
                href="https://cursor.com/community"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-700 transition-colors"
              >
                Cursor Global Community
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Questions?</h2>
            <p className="text-neutral-300 mb-6">
              If you have questions about our organization, our relationship with Cursor, or our
              partnerships, please contact us at{" "}
              <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
                hello@cursorboston.com
              </a>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">
                Privacy Policy
              </Link>
              {" | "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
