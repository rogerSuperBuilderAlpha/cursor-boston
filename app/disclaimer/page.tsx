import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Legal disclaimer for Cursor Boston - An independent community supported by the Cursor Ambassadors Program.",
};

export default function DisclaimerPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Disclaimer
          </h1>
          <p className="text-neutral-400">
            Important information about Cursor Boston&apos;s status and affiliations
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
                  Independent Community, Official Support
                </h2>
                <p className="text-neutral-300">
                  Cursor Boston is an <strong className="text-white">independent, volunteer-run
                  community</strong> that receives support through the{" "}
                  <a
                    href="https://cursor.com/ambassadors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Cursor Ambassadors Program
                  </a>
                  . We are not employees, contractors, or official representatives of Cursor or Anysphere Inc.
                </p>
              </div>
            </div>
          </div>

          {/* Key Points */}
          <div className="prose prose-invert prose-neutral mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Key Points</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold text-lg">1.</span>
                <p className="text-neutral-300 m-0">
                  <strong className="text-white">We are part of the Cursor Ambassadors Program</strong> —
                  an official initiative that supports community leaders in organizing local events and
                  helping fellow developers.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold text-lg">2.</span>
                <p className="text-neutral-300 m-0">
                  <strong className="text-white">We operate independently</strong> —
                  our content, events, and opinions are our own and do not represent official
                  positions of Cursor or Anysphere Inc.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold text-lg">3.</span>
                <p className="text-neutral-300 m-0">
                  <strong className="text-white">Our partners support our community</strong> —
                  event hosts, sponsors, and partners are supporters of Cursor Boston, not
                  official partners of Cursor the company.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold text-lg">4.</span>
                <p className="text-neutral-300 m-0">
                  <strong className="text-white">&quot;Cursor&quot; is a trademark of Anysphere Inc.</strong> —
                  our use of the name is permitted through the Ambassadors Program to identify
                  our community of Cursor users.
                </p>
              </div>
            </div>
          </div>

          {/* Learn More CTA */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 md:p-8 mb-8">
            <h3 className="text-lg font-semibold text-white mb-3">
              Want to learn more?
            </h3>
            <p className="text-neutral-300 mb-4">
              Read our comprehensive guide about Cursor, the Ambassadors Program, and how
              Cursor Boston fits into the global Cursor community.
            </p>
            <Link
              href="/about-cursor"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors"
            >
              About Cursor & Our Affiliation
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
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Disclaimer Text */}
          <div className="prose prose-invert prose-neutral">
            <h2 className="text-2xl font-bold text-white mb-4">Legal Disclaimer</h2>

            <p className="text-neutral-300 mb-4">
              The information provided on this website and at our events is for general informational
              purposes only. All information is provided in good faith, however we make no representation
              or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity,
              reliability, availability, or completeness of any information.
            </p>

            <p className="text-neutral-300 mb-4">
              Under no circumstance shall Cursor Boston or its organizers have any liability to you for
              any loss or damage of any kind incurred as a result of the use of the site or reliance on
              any information provided on the site. Your use of the site and your reliance on any
              information on the site is solely at your own risk.
            </p>

            <p className="text-neutral-300">
              This website may contain links to external websites that are not provided or maintained by
              or in any way affiliated with Cursor Boston. Please note that we do not guarantee the
              accuracy, relevance, timeliness, or completeness of any information on these external websites.
            </p>
          </div>

          {/* Contact */}
          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 mb-4">
              Questions about this disclaimer or our affiliation?{" "}
              <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
                Contact us
              </a>
            </p>
            <p className="text-neutral-500 text-sm">
              See also:{" "}
              <Link href="/about-cursor" className="text-emerald-400 hover:text-emerald-300">
                About Cursor & Our Affiliation
              </Link>
              {" | "}
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
