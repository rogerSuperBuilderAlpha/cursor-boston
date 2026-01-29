import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Cursor Boston - Guidelines for using our community platform and services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-neutral-400">
            Last updated: January 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">Agreement to Terms</h2>
          <p className="text-neutral-300 mb-6">
            By accessing or using Cursor Boston&apos;s website and services, you agree to be bound by
            these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Description of Services</h2>
          <p className="text-neutral-300 mb-6">
            Cursor Boston is a community platform that provides:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Information about community events and meetups</li>
            <li>A member directory for community networking</li>
            <li>Event registration and RSVP functionality</li>
            <li>Talk and event submission capabilities</li>
            <li>Community discussion features</li>
            <li>Educational content and resources</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">User Accounts</h2>
          <p className="text-neutral-300 mb-6">
            When you create an account, you agree to:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly update any changes to your information</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Community Guidelines</h2>
          <p className="text-neutral-300 mb-4">
            As a member of the Cursor Boston community, you agree to:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Treat all community members with respect and professionalism</li>
            <li>Not harass, discriminate against, or abuse other members</li>
            <li>Not post spam, malicious content, or misleading information</li>
            <li>Not use the platform for illegal activities</li>
            <li>Not impersonate others or misrepresent your affiliation</li>
            <li>Not attempt to gain unauthorized access to our systems</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Intellectual Property</h2>
          <p className="text-neutral-300 mb-6">
            The Cursor Boston website, logo, and original content are protected by copyright and
            other intellectual property laws. Our platform code is open source under the GPL-3.0
            license.
          </p>
          <p className="text-neutral-300 mb-6">
            Content you submit (talks, posts, profile information) remains yours, but you grant us
            a non-exclusive license to display and distribute it through our platform.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Events and Venues</h2>
          <p className="text-neutral-300 mb-6">
            Cursor Boston organizes community events at various venues. By attending events, you agree to:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Follow venue rules and guidelines</li>
            <li>Behave respectfully toward other attendees, speakers, and venue staff</li>
            <li>Acknowledge that photography/video may be taken at events</li>
            <li>Accept that event details may change and we are not liable for such changes</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Disclaimers</h2>
          <p className="text-neutral-300 mb-6">
            Our services are provided &quot;as is&quot; without warranties of any kind. We do not guarantee:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Uninterrupted or error-free service</li>
            <li>The accuracy of user-submitted content</li>
            <li>The quality or safety of third-party services or venues</li>
            <li>Any specific outcomes from using our platform or attending events</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Limitation of Liability</h2>
          <p className="text-neutral-300 mb-6">
            To the maximum extent permitted by law, Cursor Boston and its organizers shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages arising
            from your use of our services or attendance at our events.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Termination</h2>
          <p className="text-neutral-300 mb-6">
            We reserve the right to suspend or terminate your account if you violate these terms
            or engage in behavior harmful to the community. You may also delete your account at
            any time through your profile settings.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Changes to Terms</h2>
          <p className="text-neutral-300 mb-6">
            We may update these Terms of Service from time to time. Continued use of our services
            after changes constitutes acceptance of the new terms.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Governing Law</h2>
          <p className="text-neutral-300 mb-6">
            These terms are governed by the laws of the Commonwealth of Massachusetts, United States.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Contact Us</h2>
          <p className="text-neutral-300 mb-6">
            If you have questions about these Terms of Service, please contact us at{" "}
            <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
              hello@cursorboston.com
            </a>
          </p>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">
                Privacy Policy
              </Link>
              {" | "}
              <Link href="/disclaimer" className="text-emerald-400 hover:text-emerald-300">
                Affiliation Disclaimer
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
