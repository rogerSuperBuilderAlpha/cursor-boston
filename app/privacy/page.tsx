import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Cursor Boston - How we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-neutral-400">Last updated: January 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
          <p className="text-neutral-300 mb-6">
            Cursor Boston (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
            when you visit our website and use our services.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Information We Collect</h2>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Information You Provide</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Account information (name, email address) when you create an account</li>
            <li>Profile information (bio, social links, profile photo) that you choose to add</li>
            <li>Event registration information when you sign up for events</li>
            <li>Talk and event submissions</li>
            <li>Communications when you contact us or participate in community discussions</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Information Collected Automatically</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Log data (IP address, browser type, pages visited)</li>
            <li>Device information</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Third-Party Services</h3>
          <p className="text-neutral-300 mb-6">
            When you connect third-party accounts (Discord, GitHub), we receive limited information
            from those services to enhance your experience.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">How We Use Your Information</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>To provide and maintain our services</li>
            <li>To process event registrations and submissions</li>
            <li>To communicate with you about events and community updates</li>
            <li>To display your public profile to other community members (if you opt in)</li>
            <li>To improve our website and services</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Data Sharing</h2>
          <p className="text-neutral-300 mb-4">We do not sell your personal information. We may share information with:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Service providers who help us operate our platform (Firebase, hosting providers)</li>
            <li>Event hosts and partners, only as necessary for event coordination</li>
            <li>Law enforcement when required by law</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Data Security</h2>
          <p className="text-neutral-300 mb-6">
            We implement appropriate technical and organizational measures to protect your personal
            information. However, no method of transmission over the Internet is 100% secure.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Your Rights</h2>
          <p className="text-neutral-300 mb-4">You have the right to:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account and associated data</li>
            <li>Control your profile visibility settings</li>
            <li>Disconnect third-party accounts at any time</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Cookies</h2>
          <p className="text-neutral-300 mb-6">
            We use cookies to maintain your session, remember preferences, and analyze site usage.
            See our{" "}
            <Link href="/cookies" className="text-emerald-400 hover:text-emerald-300">
              Cookie Policy
            </Link>{" "}
            for more details.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Children&apos;s Privacy</h2>
          <p className="text-neutral-300 mb-6">
            Our services are not intended for individuals under the age of 13. We do not knowingly
            collect personal information from children under 13.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Changes to This Policy</h2>
          <p className="text-neutral-300 mb-6">
            We may update this Privacy Policy from time to time. We will notify you by posting the
            new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Contact Us</h2>
          <p className="text-neutral-300 mb-6">
            Questions about this Privacy Policy? Contact us at{" "}
            <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
              hello@cursorboston.com
            </a>
          </p>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
              {" | "}
              <Link href="/cookies" className="text-emerald-400 hover:text-emerald-300">Cookie Policy</Link>
              {" | "}
              <Link href="/disclaimer" className="text-emerald-400 hover:text-emerald-300">Disclaimer</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
