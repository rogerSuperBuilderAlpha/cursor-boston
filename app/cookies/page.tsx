import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Cookie Policy for Cursor Boston - Learn how we use cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Cookie Policy
          </h1>
          <p className="text-neutral-400">
            Last updated: January 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert prose-neutral">
          <h2 className="text-2xl font-bold text-white mb-4">What Are Cookies</h2>
          <p className="text-neutral-300 mb-6">
            Cookies are small text files that are stored on your device when you visit a website.
            They are widely used to make websites work more efficiently and to provide information
            to website owners.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">How We Use Cookies</h2>
          <p className="text-neutral-300 mb-4">
            Cursor Boston uses cookies and similar technologies for the following purposes:
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Essential Cookies</h3>
          <p className="text-neutral-300 mb-4">
            These cookies are necessary for the website to function properly:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              <strong className="text-white">Authentication:</strong> To keep you logged in and
              maintain your session
            </li>
            <li>
              <strong className="text-white">Security:</strong> To protect against cross-site
              request forgery and other security threats
            </li>
            <li>
              <strong className="text-white">Preferences:</strong> To remember your settings
              (e.g., welcome modal dismissed)
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Analytics Cookies</h3>
          <p className="text-neutral-300 mb-4">
            We may use analytics cookies to understand how visitors interact with our website:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              <strong className="text-white">Firebase Analytics:</strong> To collect anonymous
              usage data and improve our services
            </li>
            <li>
              <strong className="text-white">Performance monitoring:</strong> To identify and
              fix technical issues
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Third-Party Cookies</h3>
          <p className="text-neutral-300 mb-4">
            Some third-party services we use may set their own cookies:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              <strong className="text-white">Firebase:</strong> For authentication and database
              services
            </li>
            <li>
              <strong className="text-white">Luma:</strong> When you interact with event
              registration widgets
            </li>
            <li>
              <strong className="text-white">Discord/GitHub:</strong> When you connect your
              accounts via OAuth
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Cookies We Use</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th className="text-left py-3 px-4 text-white font-semibold">Cookie Name</th>
                  <th className="text-left py-3 px-4 text-white font-semibold">Purpose</th>
                  <th className="text-left py-3 px-4 text-white font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                <tr className="border-b border-neutral-800">
                  <td className="py-3 px-4 font-mono text-sm">cursor-boston-welcome-seen</td>
                  <td className="py-3 px-4">Remembers if you&apos;ve dismissed the welcome modal</td>
                  <td className="py-3 px-4">Persistent</td>
                </tr>
                <tr className="border-b border-neutral-800">
                  <td className="py-3 px-4 font-mono text-sm">Firebase Auth</td>
                  <td className="py-3 px-4">Maintains your login session</td>
                  <td className="py-3 px-4">Session/Persistent</td>
                </tr>
                <tr className="border-b border-neutral-800">
                  <td className="py-3 px-4 font-mono text-sm">__session</td>
                  <td className="py-3 px-4">Session management</td>
                  <td className="py-3 px-4">Session</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Local Storage</h2>
          <p className="text-neutral-300 mb-6">
            In addition to cookies, we use browser local storage to store:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>User preferences and settings</li>
            <li>Cached data to improve performance</li>
            <li>Authentication tokens</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Managing Cookies</h2>
          <p className="text-neutral-300 mb-4">
            You can control and manage cookies in several ways:
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Browser Settings</h3>
          <p className="text-neutral-300 mb-4">
            Most browsers allow you to:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>See what cookies are stored and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies</li>
            <li>Delete all cookies when you close the browser</li>
          </ul>
          <p className="text-neutral-300 mb-6">
            Note that blocking all cookies may impact the functionality of our website,
            particularly features that require you to be logged in.
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Browser-Specific Instructions</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-6">
            <li>
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Google Chrome
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a
                href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Safari
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Microsoft Edge
              </a>
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Do Not Track</h2>
          <p className="text-neutral-300 mb-6">
            Some browsers have a &quot;Do Not Track&quot; feature that signals to websites that you
            do not want to be tracked. Our website does not currently respond to Do Not Track
            signals, but we limit tracking to essential analytics as described above.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Changes to This Policy</h2>
          <p className="text-neutral-300 mb-6">
            We may update this Cookie Policy from time to time. We will notify you of any
            changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>

          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Contact Us</h2>
          <p className="text-neutral-300 mb-6">
            If you have questions about our use of cookies, please contact us at{" "}
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
