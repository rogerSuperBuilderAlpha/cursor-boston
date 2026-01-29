import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "Cursor Boston's commitment to digital accessibility - Learn about our efforts to make our website accessible to everyone.",
};

export default function AccessibilityPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Accessibility Statement
          </h1>
          <p className="text-neutral-400">
            Our commitment to making Cursor Boston accessible to everyone
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">Our Commitment</h2>
          <p className="text-neutral-300 mb-6">
            Cursor Boston is committed to ensuring digital accessibility for people with
            disabilities. We are continually improving the user experience for everyone and
            applying the relevant accessibility standards.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Conformance Status</h2>
          <p className="text-neutral-300 mb-6">
            We aim to conform to the{" "}
            <a
              href="https://www.w3.org/WAI/standards-guidelines/wcag/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Web Content Accessibility Guidelines (WCAG) 2.1
            </a>{" "}
            at Level AA. These guidelines explain how to make web content more accessible for
            people with disabilities.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Accessibility Features</h2>
          <p className="text-neutral-300 mb-4">
            We have implemented the following accessibility features on our website:
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Navigation</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Skip to main content link for keyboard users</li>
            <li>Consistent navigation structure across all pages</li>
            <li>Descriptive page titles and headings</li>
            <li>Logical heading hierarchy (h1, h2, h3, etc.)</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Visual Design</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Sufficient color contrast ratios</li>
            <li>Text can be resized up to 200% without loss of functionality</li>
            <li>Focus indicators for interactive elements</li>
            <li>No content flashes more than three times per second</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Forms and Interactive Elements</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Labels associated with form inputs</li>
            <li>Error messages that identify the field and describe the error</li>
            <li>Keyboard accessible buttons and links</li>
            <li>ARIA labels for interactive components</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Images and Media</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Alternative text for meaningful images</li>
            <li>Decorative images marked appropriately</li>
            <li>SVG icons have appropriate aria-hidden or aria-label attributes</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Assistive Technologies</h2>
          <p className="text-neutral-300 mb-4">
            Our website is designed to be compatible with the following assistive technologies:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Screen readers (NVDA, JAWS, VoiceOver)</li>
            <li>Screen magnification software</li>
            <li>Speech recognition software</li>
            <li>Keyboard-only navigation</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Known Limitations</h2>
          <p className="text-neutral-300 mb-4">
            While we strive for accessibility, some areas may have limitations:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              <strong className="text-white">Third-party content:</strong> Some embedded content
              from third parties (e.g., Luma event widgets) may not be fully accessible
            </li>
            <li>
              <strong className="text-white">User-generated content:</strong> Content submitted
              by users may not always meet accessibility guidelines
            </li>
            <li>
              <strong className="text-white">PDF documents:</strong> If we have any PDF documents,
              they may not be fully accessible
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Event Accessibility</h2>
          <p className="text-neutral-300 mb-6">
            We strive to make our in-person events accessible. If you have specific accessibility
            needs for an event, please contact us in advance so we can make appropriate arrangements.
            This may include:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Wheelchair accessible venues</li>
            <li>Reserved seating near the front</li>
            <li>Assistive listening devices (when available)</li>
            <li>Dietary accommodations</li>
            <li>Quiet spaces for breaks</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Feedback</h2>
          <p className="text-neutral-300 mb-6">
            We welcome your feedback on the accessibility of Cursor Boston. Please let us know if
            you encounter accessibility barriers:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              Email:{" "}
              <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
                hello@cursorboston.com
              </a>
            </li>
            <li>
              GitHub:{" "}
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Open an issue
              </a>
            </li>
          </ul>
          <p className="text-neutral-300 mb-6">
            We try to respond to accessibility feedback within 5 business days.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Technical Specifications</h2>
          <p className="text-neutral-300 mb-6">
            Accessibility of Cursor Boston relies on the following technologies:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>HTML</li>
            <li>CSS</li>
            <li>JavaScript</li>
            <li>WAI-ARIA</li>
          </ul>
          <p className="text-neutral-300 mb-6">
            These technologies are relied upon for conformance with the accessibility standards used.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Assessment Approach</h2>
          <p className="text-neutral-300 mb-6">
            Cursor Boston assesses the accessibility of our website through:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Self-evaluation using accessibility testing tools</li>
            <li>Manual keyboard navigation testing</li>
            <li>Screen reader testing</li>
            <li>Community feedback</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Continuous Improvement</h2>
          <p className="text-neutral-300 mb-6">
            We are committed to continuously improving the accessibility of our website.
            As we develop new features and content, we incorporate accessibility considerations
            into our development process.
          </p>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              Last updated: January 2026
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
