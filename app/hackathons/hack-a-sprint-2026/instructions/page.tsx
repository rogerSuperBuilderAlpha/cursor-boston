import Link from "next/link";
import { CURSOR_CREDIT_TOP_N } from "@/lib/hackathon-event-signup";

const schedule = [
  { time: "4:00 PM", label: "Meet, greet, and get set up" },
  { time: "4:30 – 7:00 PM", label: "The Hack-a-Sprint (build period)" },
  { time: "7:00 – 8:00 PM", label: "Scoring and judging (participants, judges, and AI)" },
];

const ideas: { text: string; link?: { href: string; label: string } }[] = [
  { text: "An agent that behaves like a human assistant, handling emails on your behalf" },
  {
    text: "An agent that does LinkedIn outreach for you",
    link: { href: "https://youtu.be/8jIH8cX9ako?si=s2VH7Lb4K0OSwfOe", label: "See it in action" },
  },
  { text: "An agent that manages your calendar and schedules meetings over email" },
  {
    text: "An agent that does social media management, posting and replying on its own",
    link: { href: "https://youtu.be/HAutlM_K_xs?si=k5CdHlTMGLdPNFfB", label: "See it in action" },
  },
  { text: "An agent that looks for job postings and applies via email follow-ups" },
];

export default function HackASprint2026InstructionsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/hackathons" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Hackathons
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/hackathons/hack-a-sprint-2026"
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Hack-a-Sprint 2026
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">Instructions</span>
        </nav>

        {/* Hero */}
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Hack-a-Sprint 2026 — Pre-event instructions
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          Everything you need to do <strong className="text-foreground">before April 13</strong> so
          you can hit the ground running on event day.
        </p>

        {/* The Challenge */}
        <section className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 dark:bg-emerald-500/10">
          <h2 className="text-xl font-bold text-foreground">The Challenge</h2>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            Build an <strong className="text-foreground">AI agent</strong> using the{" "}
            <a
              href="https://inkbox.ai/docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
            >
              Inkbox SDK
            </a>{" "}
            that improves your own productivity or efficiency. Solo competition, {CURSOR_CREDIT_TOP_N} builders, 2.5 hours
            to ship.
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Your agent should use at least one Inkbox capability (email, phone, or vault) and
            solve a real problem in your day-to-day workflow.
          </p>
        </section>

        {/* What is Inkbox? */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">What is Inkbox?</h2>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            <a
              href="https://inkbox.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
            >
              Inkbox
            </a>{" "}
            gives AI agents their email, phone, and secure vault.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Identities",
                desc: "Persistent, named agents with their own email address and phone number.",
              },
              {
                title: "Email",
                desc: "Send and receive emails, manage threads, search messages, attachments, and webhooks.",
              },
              {
                title: "Phone",
                desc: "Outbound and inbound calls with real-time audio, built-in STT/TTS, and transcripts.",
              },
              {
                title: "Vault",
                desc: "Zero-knowledge encrypted credential storage with TOTP support for your agents.",
              },
            ].map((cap) => (
              <div
                key={cap.title}
                className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <p className="text-sm font-semibold text-foreground">{cap.title}</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{cap.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Get set up before the event */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">Get set up before the event</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Do these steps ahead of time so you can start building immediately at 4:30 PM.
          </p>
          <ol className="mt-4 list-decimal list-inside space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-foreground">Get an API key</strong> — sign up at{" "}
              <a
                href="https://inkbox.ai/console"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline dark:text-emerald-400"
              >
                inkbox.ai/console
              </a>{" "}
              and create an API key from the dashboard.
            </li>
            <li>
              <strong className="text-foreground">Install the SDK</strong>
              <div className="mt-2 space-y-2">
                <pre className="rounded-lg bg-neutral-900 px-4 py-2 text-xs text-neutral-100 overflow-x-auto">
                  pip install inkbox
                </pre>
                <pre className="rounded-lg bg-neutral-900 px-4 py-2 text-xs text-neutral-100 overflow-x-auto">
                  npm install @inkbox/sdk
                </pre>
              </div>
            </li>
            <li>
              <strong className="text-foreground">Create an identity and send a test email</strong>
              <pre className="mt-2 rounded-lg bg-neutral-900 px-4 py-3 text-xs text-neutral-100 overflow-x-auto">{`from inkbox import Inkbox

with Inkbox(api_key="ApiKey_...") as inkbox:
    identity = inkbox.create_identity("my-agent")
    identity.send_email(
        to=["you@example.com"],
        subject="Hello from my agent",
        body_text="It works!",
    )`}</pre>
            </li>
            <li>
              <strong className="text-foreground">Explore the docs</strong> —{" "}
              <a
                href="https://inkbox.ai/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline dark:text-emerald-400"
              >
                inkbox.ai/docs
              </a>{" "}
              covers identities, email, phone, vault, and webhooks with full examples. The SDK
              is open-source at{" "}
              <a
                href="https://github.com/inkbox-ai/inkbox"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline dark:text-emerald-400"
              >
                github.com/inkbox-ai/inkbox
              </a>
              .
            </li>
          </ol>
        </section>

        {/* Ideas */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">Ideas to get you thinking</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            You are not limited to these — build whatever makes <em>you</em> more productive.
          </p>
          <ul className="mt-4 space-y-2">
            {ideas.map((idea) => (
              <li
                key={idea.text}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
              >
                <span className="mt-0.5 text-emerald-500">&#x2022;</span>
                <span>
                  {idea.text}
                  {idea.link && (
                    <>
                      {" — "}
                      <a
                        href={idea.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
                      >
                        {idea.link.label}
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Event day schedule */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">Event day schedule</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            April 13, 2026 — Back Bay, Boston, MA. All times Eastern.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            {schedule.map((s, i) => (
              <div
                key={s.time}
                className={`flex items-center gap-4 px-4 py-3 text-sm ${
                  i > 0 ? "border-t border-neutral-200 dark:border-neutral-800" : ""
                }`}
              >
                <span className="w-36 shrink-0 font-mono text-xs text-neutral-500">{s.time}</span>
                <span className="text-neutral-700 dark:text-neutral-300">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* What to bring */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">What to bring</h2>
          <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            <li>Laptop and charger</li>
            <li>A project idea or problem to explore</li>
            <li>A willingness to build with new tools</li>
          </ul>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Food and drinks will be provided.
          </p>
        </section>

        {/* Account setup checklist */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">cursorboston.com account setup</h2>
          <ol className="mt-4 list-decimal list-inside space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li>Create an account at cursorboston.com</li>
            <li>Connect your GitHub account</li>
            <li>Connect your Discord account</li>
            <li>Enable public profile and show Discord on profile</li>
            <li>
              Complete{" "}
              <Link
                href="/hackathons/hack-a-sprint-2026/signup"
                className="text-emerald-600 underline dark:text-emerald-400"
              >
                website signup
              </Link>{" "}
              to claim your spot on the leaderboard
            </li>
          </ol>
        </section>

        {/* Prizes */}
        <section className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:bg-amber-500/10">
          <h2 className="text-xl font-bold text-foreground">Prizes</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-foreground">$50 Cursor credits</strong> — guaranteed for every
              selected participant (top {CURSOR_CREDIT_TOP_N} on the signup list)
            </li>
            <li>
              <strong className="text-foreground">$1,200 prize pool</strong> — six $200 winning
              spots awarded by combined peer, judge, and AI scoring
            </li>
          </ul>
        </section>

        {/* Submission overview */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground">Submission overview</h2>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Full submission instructions unlock on event day.
          </p>
        </section>

        {/* Links */}
        <section className="mt-10 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-foreground">Links</h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a
              href="https://luma.com/uixo8hl6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Luma registration
            </a>
            <Link
              href="/hackathons/hack-a-sprint-2026/signup"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Website signup
            </Link>
            <a
              href="https://inkbox.ai/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Inkbox docs
            </a>
            <a
              href="https://inkbox.ai/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Inkbox console
            </a>
            <a
              href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              GitHub repo
            </a>
          </div>
        </section>

        <p className="mt-10 text-xs text-neutral-500">
          Questions? Reach out to roger@cursorboston.com or ray@inkbox.ai. See you on April 13.
        </p>
      </div>
    </div>
  );
}
