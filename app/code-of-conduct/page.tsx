import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Code of Conduct",
  description: "Cursor Boston community Code of Conduct - Guidelines for a welcoming and inclusive community.",
};

export default function CodeOfConductPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Code of Conduct</h1>
          <p className="text-neutral-400">Our commitment to a welcoming, inclusive, and harassment-free community</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Pledge */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 md:p-8 mb-8">
            <h2 className="text-xl font-bold text-emerald-400 mb-3">Our Pledge</h2>
            <p className="text-neutral-300">
              We pledge to make participation in our community a harassment-free experience for everyone,
              regardless of age, body size, disability, ethnicity, gender identity, level of experience,
              education, socio-economic status, nationality, personal appearance, race, religion, or
              sexual identity and orientation.
            </p>
          </div>

          <div className="prose prose-invert prose-neutral">
            <h2 className="text-2xl font-bold text-white mb-4">Our Standards</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Positive Behavior</h3>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>Demonstrating empathy and kindness</li>
              <li>Being respectful of differing opinions and experiences</li>
              <li>Giving and gracefully accepting constructive feedback</li>
              <li>Accepting responsibility for mistakes and learning from them</li>
              <li>Focusing on what is best for the overall community</li>
              <li>Welcoming newcomers and helping them get started</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">Unacceptable Behavior</h3>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>Sexualized language or imagery, and unwelcome sexual attention</li>
              <li>Trolling, insulting comments, and personal attacks</li>
              <li>Public or private harassment</li>
              <li>Publishing others&apos; private information without permission</li>
              <li>Disruption of talks, events, or online discussions</li>
              <li>Aggressive recruiting or solicitation without permission</li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Event Guidelines</h2>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>Respect the venue and its staff</li>
              <li>Follow venue-specific rules</li>
              <li>Ask permission before photographing others</li>
              <li>Report safety concerns to organizers immediately</li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Enforcement</h2>
            <p className="text-neutral-300 mb-4">
              Community leaders will enforce these standards. Consequences include:
            </p>
            <div className="space-y-3 mb-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <span className="text-white font-semibold">1. Correction</span>
                <span className="text-neutral-400"> - Private warning for minor issues</span>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <span className="text-white font-semibold">2. Warning</span>
                <span className="text-neutral-400"> - Formal warning with consequences for continued behavior</span>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <span className="text-white font-semibold">3. Temporary Ban</span>
                <span className="text-neutral-400"> - Temporary removal for serious violations</span>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <span className="text-white font-semibold">4. Permanent Ban</span>
                <span className="text-neutral-400"> - Permanent removal for egregious behavior</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Reporting</h2>
            <p className="text-neutral-300 mb-6">
              Report unacceptable behavior to{" "}
              <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
                hello@cursorboston.com
              </a>
              . At events, report to any organizer. All reports are handled confidentially.
            </p>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Attribution</h2>
            <p className="text-neutral-300 mb-6">
              Adapted from the{" "}
              <a href="https://www.contributor-covenant.org/version/2/1/code_of_conduct/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Contributor Covenant
              </a>
              , version 2.1.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
              {" | "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
