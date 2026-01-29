import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookie Policy for Cursor Boston - How we use cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Cookie Policy</h1>
          <p className="text-neutral-400">Last updated: January 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">What Are Cookies</h2>
          <p className="text-neutral-300 mb-6">
            Cookies are small text files stored on your device when you visit a website. They help
            make websites work more efficiently and provide information to website owners.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">How We Use Cookies</h2>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Essential Cookies</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li><strong className="text-white">Authentication:</strong> Keep you logged in</li>
            <li><strong className="text-white">Security:</strong> Protect against security threats</li>
            <li><strong className="text-white">Preferences:</strong> Remember your settings</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Analytics Cookies</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li><strong className="text-white">Firebase Analytics:</strong> Collect anonymous usage data</li>
            <li><strong className="text-white">Performance monitoring:</strong> Identify technical issues</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Third-Party Cookies</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li><strong className="text-white">Firebase:</strong> Authentication and database services</li>
            <li><strong className="text-white">Luma:</strong> Event registration widgets</li>
            <li><strong className="text-white">Discord/GitHub:</strong> OAuth account connections</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Managing Cookies</h2>
          <p className="text-neutral-300 mb-4">Most browsers allow you to:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>See and delete cookies individually</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies</li>
            <li>Delete cookies when you close the browser</li>
          </ul>
          <p className="text-neutral-300 mb-6">
            Note: Blocking all cookies may impact functionality, especially login features.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Browser Settings</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Google Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                Microsoft Edge
              </a>
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Contact Us</h2>
          <p className="text-neutral-300 mb-6">
            Questions about cookies? Contact us at{" "}
            <a href="mailto:hello@cursorboston.com" className="text-emerald-400 hover:text-emerald-300">
              hello@cursorboston.com
            </a>
          </p>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">Privacy Policy</Link>
              {" | "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
