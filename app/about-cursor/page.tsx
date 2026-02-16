import { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "About Cursor & Our Affiliation",
  description:
    "Learn about Cursor, the AI-powered code editor, and how Cursor Boston connects to the global Cursor community through the Ambassadors program.",
};

export default function AboutCursorPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            About Cursor & Our Affiliation
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Understanding the relationship between Cursor Boston and Cursor, the AI-powered code editor
          </p>
        </div>
      </section>

      {/* What is Cursor */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">What is Cursor?</h2>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <p className="text-neutral-300 mb-4">
                <a
                  href="https://cursor.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Cursor
                </a>{" "}
                is an AI-powered code editor built on Visual Studio Code. It integrates cutting-edge
                AI models directly into the coding environment, providing developers with an intelligent
                pair programmer that understands their codebase.
              </p>
              <p className="text-neutral-300 mb-4">
                Cursor is developed by{" "}
                <strong className="text-white">Anysphere Inc.</strong>, a company focused on building
                AI-first development tools. The editor has gained significant popularity among developers
                for its ability to accelerate coding workflows through AI assistance.
              </p>
              <p className="text-neutral-300">
                Key features include intelligent code completion, natural language code editing,
                codebase-aware chat, and multi-file editing capabilities powered by frontier AI models.
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Key Facts</h3>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Built on VS Code foundation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Integrates Claude, GPT-4, and other AI models</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Developed by Anysphere Inc.</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Growing global developer community</span>
                </li>
              </ul>
              <a
                href="https://cursor.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Visit cursor.com
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Cursor Ambassadors Program */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white">The Cursor Ambassadors Program</h2>
          </div>

          <p className="text-neutral-300 mb-8 text-lg">
            The{" "}
            <a
              href="https://cursor.com/ambassadors"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Cursor Ambassadors Program
            </a>{" "}
            is an official initiative by Cursor to empower community leaders who help make the
            Cursor ecosystem vibrant and collaborative. Ambassadors are passionate developers who
            volunteer their time to support and grow local Cursor communities around the world.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What Ambassadors Do</h3>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <span>Help fellow developers troubleshoot and optimize their Cursor workflow</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>Host community meetups, hackathons, and workshops</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>Share expertise and insights about AI-powered development</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">4.</span>
                  <span>Provide direct feedback to the Cursor team to shape the product&apos;s future</span>
                </li>
              </ul>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Ambassador Benefits</h3>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Special badge recognition in Cursor forums</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Funding support for community meetups and events</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Direct communication channel with the Cursor team</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Connection with a global network of community leaders</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Other Community Programs</h3>
            <p className="text-neutral-300 mb-4">
              In addition to the Ambassadors program, Cursor also runs a{" "}
              <strong className="text-white">Campus Leads</strong> program for students at universities.
              Campus Leads are representatives at schools who teach best practices, organize campus events,
              and share Cursor with their academic communities.
            </p>
            <a
              href="https://cursor.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Learn more about Cursor Community programs
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Cursor Boston's Relationship */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Logo size="footer" />
            <h2 className="text-3xl font-bold text-white">Cursor Boston&apos;s Relationship with Cursor</h2>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 md:p-8 mb-8">
            <h3 className="text-xl font-bold text-emerald-400 mb-3">Our Status</h3>
            <p className="text-neutral-200 text-lg">
              Cursor Boston is led by members of the{" "}
              <strong className="text-white">Cursor Ambassadors Program</strong>. This means we are
              officially recognized community leaders who have been vetted and supported by Cursor
              to organize local community activities in the Boston area.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-3">What This Means</h3>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    <strong className="text-white">Official Recognition:</strong> We are part of Cursor&apos;s
                    official community network and have permission to use the Cursor name
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    <strong className="text-white">Support:</strong> We receive support from Cursor to help
                    fund and organize community events
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    <strong className="text-white">Feedback Channel:</strong> We have direct communication
                    with the Cursor team and can relay community feedback
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-3">What This Does NOT Mean</h3>
              <ul className="space-y-3 text-neutral-300">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>
                    <strong className="text-white">Not Employees:</strong> We are volunteers, not employees
                    or contractors of Cursor or Anysphere Inc.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>
                    <strong className="text-white">Not Official Representatives:</strong> Our views and
                    opinions do not represent Cursor&apos;s official positions
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>
                    <strong className="text-white">Independent Operations:</strong> Our day-to-day operations,
                    content, and event decisions are made independently
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* About Our Partners */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">About Our Partners & Sponsors</h2>

          <p className="text-neutral-300 mb-6">
            Cursor Boston collaborates with various venues, sponsors, and community partners to bring
            events and resources to our members. It&apos;s important to understand the nature of these relationships:
          </p>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-8">
            <ul className="space-y-4 text-neutral-300">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Event hosts and venue partners are <strong className="text-white">supporters of
                  the Cursor Boston community</strong>, not official partners of Cursor the company
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Sponsorships and partnerships with Cursor Boston <strong className="text-white">do not
                  imply</strong> a business relationship with Cursor or Anysphere Inc.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Partner logos on our platform indicate support for <strong className="text-white">our
                  local community</strong>, not an endorsement by Cursor
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Trademark Notice */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Trademark Notice</h2>

          <p className="text-neutral-300 mb-4">
            &quot;Cursor&quot; is a trademark of Anysphere Inc. Our use of the Cursor name in &quot;Cursor Boston&quot;
            is to identify our community of Cursor users in the Boston area.
          </p>
          <p className="text-neutral-300">
            This use is permitted through our participation in the Cursor Ambassadors Program.
            This does not imply ownership, endorsement, or official affiliation beyond the
            ambassadors program relationship described above.
          </p>
        </div>
      </section>

      {/* Get Involved */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Get Involved</h2>

          <p className="text-neutral-300 mb-8 max-w-2xl mx-auto">
            Whether you&apos;re interested in joining our local community or learning more about
            Cursor&apos;s global programs, here are some ways to get started:
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://discord.gg/Wsncg8YYqc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865F2] text-white rounded-lg font-semibold hover:bg-[#4752C4] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Cursor Boston Discord
            </a>
            <a
              href="https://cursor.com/ambassadors"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors"
            >
              Apply to be an Ambassador
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
            <a
              href="https://cursor.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-700 transition-colors"
            >
              Explore Global Community
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              Questions about our relationship with Cursor?{" "}
              <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
                Contact us
              </a>
            </p>
            <p className="text-neutral-500 text-sm mt-2">
              See also:{" "}
              <Link href="/disclaimer" className="text-emerald-400 hover:text-emerald-300">
                Legal Disclaimer
              </Link>
              {" | "}
              <Link href="/about" className="text-emerald-400 hover:text-emerald-300">
                About Cursor Boston
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
