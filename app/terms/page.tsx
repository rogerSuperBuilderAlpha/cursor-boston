import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Cursor Boston - Guidelines for using our community platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-neutral-400">Last updated: January 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">Agreement to Terms</h2>
          <p className="text-neutral-300 mb-6">
            By accessing or using Cursor Boston&apos;s website and services, you agree to be bound by
            these Terms of Service. If you do not agree, please do not use our services.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Description of Services</h2>
          <p className="text-neutral-300 mb-4">Cursor Boston provides:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Information about community events and meetups</li>
            <li>A member directory for community networking</li>
            <li>Event registration and RSVP functionality</li>
            <li>Talk and event submission capabilities</li>
            <li>Community discussion features</li>
            <li>Educational content and resources</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">User Accounts</h2>
          <p className="text-neutral-300 mb-4">When you create an account, you agree to:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly update any changes to your information</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Community Guidelines</h2>
          <p className="text-neutral-300 mb-4">As a member, you agree to:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Treat all community members with respect</li>
            <li>Not harass, discriminate against, or abuse other members</li>
            <li>Not post spam, malicious content, or misleading information</li>
            <li>Not use the platform for illegal activities</li>
            <li>Not impersonate others or misrepresent your affiliation</li>
          </ul>
          <p className="text-neutral-300 mb-6">
            See our full{" "}
            <Link href="/code-of-conduct" className="text-emerald-400 hover:text-emerald-300">
              Code of Conduct
            </Link>{" "}
            for detailed community guidelines.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Events and Venues</h2>
          <p className="text-neutral-300 mb-4">By attending events, you agree to:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Follow venue rules and guidelines</li>
            <li>Behave respectfully toward attendees, speakers, and venue staff</li>
            <li>Acknowledge that photography/video may be taken at events</li>
            <li>Accept that event details may change</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Intellectual Property</h2>
          <p className="text-neutral-300 mb-6">
            The Cursor Boston website and original content are protected by copyright. Our platform
            code is open source under the GPL-3.0 license. Content you submit remains yours, but you
            grant us a license to display it through our platform.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Disclaimers</h2>
          <p className="text-neutral-300 mb-6">
            Our services are provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            uninterrupted service, accuracy of user content, or quality of third-party services.
            See our{" "}
            <Link href="/disclaimer" className="text-emerald-400 hover:text-emerald-300">
              Disclaimer
            </Link>{" "}
            for more information.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Limitation of Liability</h2>
          <p className="text-neutral-300 mb-6">
            To the maximum extent permitted by law, Cursor Boston shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of our
            services or attendance at events.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Termination</h2>
          <p className="text-neutral-300 mb-6">
            We may suspend or terminate your account for violating these terms. You may delete your
            account at any time through your profile settings.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Governing Law</h2>
          <p className="text-neutral-300 mb-6">
            These terms are governed by the laws of the Commonwealth of Massachusetts, United States.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Contact Us</h2>
          <p className="text-neutral-300 mb-6">
            Questions? Contact us at{" "}
            <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
              hello@cursorboston.com
            </a>
          </p>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">Privacy Policy</Link>
              {" | "}
              <Link href="/code-of-conduct" className="text-emerald-400 hover:text-emerald-300">Code of Conduct</Link>
              {" | "}
              <Link href="/disclaimer" className="text-emerald-400 hover:text-emerald-300">Disclaimer</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
