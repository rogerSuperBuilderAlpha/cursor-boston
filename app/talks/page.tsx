import { Metadata } from "next";
import talksData from "@/content/talks.json";

export const metadata: Metadata = {
  title: "Talks",
  description:
    "Archive of talks and presentations from Cursor Boston events. Learn from community members about AI-powered development.",
};

export default function TalksPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Talks
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Archive of presentations from our community events. Learn how others
            are using Cursor in their workflows.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
            Talk Categories
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {talksData.categories.map((category) => (
              <div
                key={category.id}
                className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <h3 className="text-foreground font-medium mb-2">{category.name}</h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  {category.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Talks List */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
            Featured Talks
          </h2>

          {talksData.talks.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {talksData.talks.map((talk: {
                id: string;
                title: string;
                speaker: string;
                date: string;
                description: string;
                category: string;
                videoUrl?: string;
              }) => (
                <div
                  key={talk.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                >
                  <div className="p-6">
                    <span className="inline-block px-2 py-1 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-xs font-medium rounded mb-3 capitalize">
                      {talk.category}
                    </span>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {talk.title}
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">
                      by {talk.speaker}
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4">
                      {talk.description}
                    </p>
                    {talk.videoUrl && (
                      <a
                        href={talk.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-foreground text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        Watch Recording
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-neutral-800">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500 dark:text-neutral-400"
                  aria-hidden="true"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Coming Soon
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Talks from our events will be added here after our first meetup.
                Check back soon!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Submit Talk CTA */}
      <section className="py-16 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Share Your Ideas
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-2">
            We&apos;re always looking for speakers to share their experiences
            with Cursor and AI-powered development.
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            <strong className="text-foreground">All skill levels are welcome</strong>{" "}
            &ndash; whether you&apos;re a seasoned developer, a designer
            exploring AI tools, a student learning to code, or from any other
            discipline using Cursor in creative ways.
          </p>
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 mb-8">
            <h3 className="text-foreground font-medium mb-3">Talk ideas include:</h3>
            <ul className="text-neutral-600 dark:text-neutral-400 text-sm space-y-2">
              <li>A workflow or technique you&apos;ve discovered</li>
              <li>A project you built with Cursor</li>
              <li>Tips for using Cursor in a specific domain</li>
              <li>Lessons learned from AI-assisted development</li>
              <li>Live coding demos and tutorials</li>
            </ul>
          </div>
          <a
            href="/talks/submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950"
          >
            Submit Your Talk Idea
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
