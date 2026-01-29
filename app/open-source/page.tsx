import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Open Source",
  description: "Cursor Boston is open source - Learn about our commitment to open source and how you can contribute.",
};

export default function OpenSourcePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Open Source at Cursor Boston
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            We believe in the power of open source to build better software and stronger communities
          </p>
        </div>
      </section>

      {/* Our Commitment */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Our Open Source Commitment</h2>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 md:p-8 mb-8">
            <p className="text-lg text-neutral-200">
              The Cursor Boston website and platform are <strong className="text-white">fully open source</strong> under
              the <strong className="text-white">GPL-3.0 license</strong>. This means anyone can view, use, modify,
              and distribute our code, as long as they maintain the same open source license.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">What&apos;s Open Source</h3>
              <ul className="space-y-2 text-neutral-300">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>All website source code</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Component library and design system</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>API routes and integrations</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Documentation and guides</span>
                </li>
              </ul>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Our License (GPL-3.0)</h3>
              <ul className="space-y-2 text-neutral-300">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Free to use for any purpose</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Free to modify and adapt</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Free to distribute</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Must keep same license (copyleft)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Open Source */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Why Open Source Matters</h2>

          <div className="prose prose-invert prose-neutral max-w-none">
            <p className="text-lg text-neutral-300 mb-6">
              Open source isn&apos;t just about code—it&apos;s about building a collaborative community where
              knowledge is shared freely and everyone can contribute to making things better.
            </p>

            <div className="grid md:grid-cols-3 gap-6 not-prose">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Transparency</h3>
                <p className="text-neutral-400 text-sm">
                  Anyone can see exactly how our platform works. No hidden surprises, no black boxes.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Community</h3>
                <p className="text-neutral-400 text-sm">
                  Built by the community, for the community. Everyone can shape the direction of the project.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Learning</h3>
                <p className="text-neutral-400 text-sm">
                  A real-world codebase for learning modern web development with Next.js, TypeScript, and Firebase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to Contribute */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">How to Contribute</h2>

          <p className="text-lg text-neutral-300 mb-8">
            We welcome contributions from developers of all skill levels! Here&apos;s how you can get involved:
          </p>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Fork the Repository</h3>
                <p className="text-neutral-300">
                  Start by forking our{" "}
                  <a
                    href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    GitHub repository
                  </a>
                  . This creates your own copy where you can make changes.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Find Something to Work On</h3>
                <p className="text-neutral-300 mb-2">
                  Check out our{" "}
                  <a
                    href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    open issues
                  </a>
                  . Look for labels like:
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">good first issue</span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">help wanted</span>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">documentation</span>
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">enhancement</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Make Your Changes</h3>
                <p className="text-neutral-300">
                  Create a branch, make your changes, and test them locally. Follow our coding standards
                  and include tests if applicable.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold shrink-0">
                4
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Submit a Pull Request</h3>
                <p className="text-neutral-300">
                  Push your changes and open a pull request. Describe what you changed and why.
                  Our team will review and provide feedback.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ways to Contribute */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Ways You Can Help</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Code Contributions</h3>
              <ul className="space-y-2 text-neutral-300">
                <li>• Fix bugs and improve performance</li>
                <li>• Add new features</li>
                <li>• Improve accessibility</li>
                <li>• Refactor and clean up code</li>
                <li>• Write tests</li>
              </ul>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Non-Code Contributions</h3>
              <ul className="space-y-2 text-neutral-300">
                <li>• Report bugs and issues</li>
                <li>• Improve documentation</li>
                <li>• Design UI/UX improvements</li>
                <li>• Write blog posts or tutorials</li>
                <li>• Help other contributors</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Contribute */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Why Contribute?</h2>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Build Your Portfolio</h3>
                <p className="text-neutral-400">Real contributions to a production app look great on your resume and GitHub profile.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Learn Modern Tech</h3>
                <p className="text-neutral-400">Work with Next.js 16, TypeScript, Firebase, Tailwind CSS, and more.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Join a Community</h3>
                <p className="text-neutral-400">Connect with other developers who share your passion for AI-powered development.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Make an Impact</h3>
                <p className="text-neutral-400">Your contributions help a real community and serve as a template for other communities.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 md:p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-3">Ready to Contribute?</h3>
            <p className="text-neutral-300 mb-6">
              Check out our repository and find something interesting to work on!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-700 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
              </a>
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors"
              >
                Browse Issues
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-800">
            <p className="text-neutral-400 text-sm">
              See also:{" "}
              <Link href="/code-of-conduct" className="text-emerald-400 hover:text-emerald-300">Code of Conduct</Link>
              {" | "}
              <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">Terms of Service</Link>
              {" | "}
              <a href="https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                GPL-3.0 License
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
