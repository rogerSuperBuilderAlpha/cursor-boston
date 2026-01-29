import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Cursor Boston's commitment to digital accessibility for all users.",
};

export default function AccessibilityPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Accessibility</h1>
          <p className="text-neutral-400">Our commitment to making Cursor Boston accessible to everyone</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">Our Commitment</h2>
          <p className="text-neutral-300 mb-6">
            Cursor Boston is committed to ensuring digital accessibility for people with disabilities.
            We continually improve the user experience for everyone and apply relevant accessibility standards.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Conformance Status</h2>
          <p className="text-neutral-300 mb-6">
            We aim to conform to{" "}
            <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
              WCAG 2.1 Level AA
            </a>
            . These guidelines explain how to make web content more accessible.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Accessibility Features</h2>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Navigation</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Skip to main content link for keyboard users</li>
            <li>Consistent navigation structure</li>
            <li>Descriptive page titles and headings</li>
            <li>Logical heading hierarchy</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Visual Design</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Sufficient color contrast ratios</li>
            <li>Text resizable up to 200%</li>
            <li>Visible focus indicators</li>
            <li>No content flashing more than 3 times per second</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Forms & Interactions</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Labels associated with form inputs</li>
            <li>Descriptive error messages</li>
            <li>Keyboard accessible buttons and links</li>
            <li>ARIA labels for interactive components</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Assistive Technologies</h2>
          <p className="text-neutral-300 mb-4">Our website is designed to work with:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Screen readers (NVDA, JAWS, VoiceOver)</li>
            <li>Screen magnification software</li>
            <li>Speech recognition software</li>
            <li>Keyboard-only navigation</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Known Limitations</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li><strong className="text-white">Third-party content:</strong> Some embedded widgets may not be fully accessible</li>
            <li><strong className="text-white">User-generated content:</strong> May not always meet accessibility guidelines</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Event Accessibility</h2>
          <p className="text-neutral-300 mb-4">
            We strive to make in-person events accessible. Contact us in advance for:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Wheelchair accessible venues</li>
            <li>Reserved seating near the front</li>
            <li>Dietary accommodations</li>
            <li>Quiet spaces for breaks</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Feedback</h2>
          <p className="text-neutral-300 mb-6">
            We welcome accessibility feedback. Contact us at{" "}
            <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
              hello@cursorboston.com
            </a>{" "}
            or{" "}
            <a href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
              open a GitHub issue
            </a>
            . We aim to respond within 5 business days.
          </p>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-500 text-sm">Last updated: January 2026</p>
          </div>
        </div>
      </section>
    </div>
  );
}
