import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Code of Conduct",
  description:
    "Cursor Boston community Code of Conduct - Our guidelines for creating a welcoming and inclusive community.",
};

export default function CodeOfConductPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Code of Conduct
          </h1>
          <p className="text-neutral-400">
            Our commitment to a welcoming, inclusive, and harassment-free community
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Pledge */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 md:p-8 mb-8">
            <h2 className="text-xl font-bold text-emerald-400 mb-3">Our Pledge</h2>
            <p className="text-neutral-300">
              We as members, contributors, and leaders pledge to make participation in our
              community a harassment-free experience for everyone, regardless of age, body size,
              visible or invisible disability, ethnicity, sex characteristics, gender identity
              and expression, level of experience, education, socio-economic status, nationality,
              personal appearance, race, religion, or sexual identity and orientation.
            </p>
          </div>

          <div className="prose prose-invert prose-neutral">
            <h2 className="text-2xl font-bold text-white mb-4">Our Standards</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">
              Examples of behavior that contributes to a positive environment:
            </h3>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>Demonstrating empathy and kindness toward other people</li>
              <li>Being respectful of differing opinions, viewpoints, and experiences</li>
              <li>Giving and gracefully accepting constructive feedback</li>
              <li>Accepting responsibility and apologizing to those affected by our mistakes</li>
              <li>Focusing on what is best not just for us as individuals, but for the overall community</li>
              <li>Welcoming newcomers and helping them get started</li>
              <li>Using welcoming and inclusive language</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">
              Examples of unacceptable behavior:
            </h3>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>The use of sexualized language or imagery, and sexual attention or advances of any kind</li>
              <li>Trolling, insulting or derogatory comments, and personal or political attacks</li>
              <li>Public or private harassment</li>
              <li>Publishing others&apos; private information without explicit permission</li>
              <li>Sustained disruption of talks, events, or online discussions</li>
              <li>Other conduct which could reasonably be considered inappropriate in a professional setting</li>
              <li>Recruiting, soliciting, or aggressive self-promotion without permission</li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Event Guidelines</h2>
            <p className="text-neutral-300 mb-4">
              When attending Cursor Boston events, please also:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>Respect the venue and its staff</li>
              <li>Follow any venue-specific rules and guidelines</li>
              <li>Be mindful of shared spaces and other people&apos;s comfort</li>
              <li>Ask permission before photographing or recording others</li>
              <li>Report any safety concerns to event organizers immediately</li>
              <li>Help create an environment where everyone can learn and network</li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Online Spaces</h2>
            <p className="text-neutral-300 mb-4">
              In our Discord server, GitHub discussions, and other online spaces:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
              <li>Stay on topic in designated channels</li>
              <li>Avoid spam, excessive self-promotion, or unsolicited direct messages</li>
              <li>Use content warnings for potentially sensitive topics</li>
              <li>Respect others&apos; time by doing basic research before asking questions</li>
              <li>Give credit when sharing others&apos; work or ideas</li>
            </ul>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Enforcement Responsibilities</h2>
            <p className="text-neutral-300 mb-6">
              Community leaders are responsible for clarifying and enforcing our standards of
              acceptable behavior and will take appropriate and fair corrective action in response
              to any behavior that they deem inappropriate, threatening, offensive, or harmful.
            </p>
            <p className="text-neutral-300 mb-6">
              Community leaders have the right and responsibility to remove, edit, or reject
              comments, commits, code, wiki edits, issues, and other contributions that are not
              aligned with this Code of Conduct, and will communicate reasons for moderation
              decisions when appropriate.
            </p>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Enforcement Guidelines</h2>
            <p className="text-neutral-300 mb-4">
              Community leaders will follow these guidelines in determining consequences:
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">1. Correction</h4>
                <p className="text-neutral-400 text-sm mb-2">
                  <strong>Impact:</strong> Minor unprofessional or unwelcome behavior
                </p>
                <p className="text-neutral-400 text-sm">
                  <strong>Consequence:</strong> A private, written warning with clarity around the violation
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">2. Warning</h4>
                <p className="text-neutral-400 text-sm mb-2">
                  <strong>Impact:</strong> A violation through a single incident or series of actions
                </p>
                <p className="text-neutral-400 text-sm">
                  <strong>Consequence:</strong> A warning with consequences for continued behavior
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">3. Temporary Ban</h4>
                <p className="text-neutral-400 text-sm mb-2">
                  <strong>Impact:</strong> A serious violation or sustained inappropriate behavior
                </p>
                <p className="text-neutral-400 text-sm">
                  <strong>Consequence:</strong> Temporary ban from community interaction for a specified period
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">4. Permanent Ban</h4>
                <p className="text-neutral-400 text-sm mb-2">
                  <strong>Impact:</strong> Pattern of violation or egregious behavior
                </p>
                <p className="text-neutral-400 text-sm">
                  <strong>Consequence:</strong> Permanent ban from all community spaces and events
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Reporting</h2>
            <p className="text-neutral-300 mb-6">
              If you experience or witness unacceptable behavior, or have any other concerns,
              please report it by contacting us at{" "}
              <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
                hello@cursorboston.com
              </a>
              . All reports will be handled with discretion and confidentiality.
            </p>
            <p className="text-neutral-300 mb-6">
              At events, you can also report issues to any organizer or volunteer wearing
              an organizer badge.
            </p>

            <h2 className="text-2xl font-bold text-white mb-4 mt-8">Attribution</h2>
            <p className="text-neutral-300 mb-6">
              This Code of Conduct is adapted from the{" "}
              <a
                href="https://www.contributor-covenant.org/version/2/1/code_of_conduct/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Contributor Covenant
              </a>
              , version 2.1.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">
                Terms of Service
              </Link>
              {" | "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
