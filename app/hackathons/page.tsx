import { Metadata } from "next";
import Link from "next/link";
import { getCurrentVirtualHackathonId, getMonthEndFromVirtualId } from "@/lib/hackathons";

export const metadata: Metadata = {
  title: "Hackathons",
  description:
    "Monthly virtual hackathons and in-person events. Form teams of three, build with Cursor, and submit your project.",
};

function formatMonthLabel(hackathonId: string): string {
  const match = hackathonId.match(/^virtual-(\d{4})-(\d{2})$/);
  if (!match) return hackathonId;
  const [, year, month] = match;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function HackathonsPage() {
  const currentId = getCurrentVirtualHackathonId();
  const monthEnd = getMonthEndFromVirtualId(currentId);
  const monthLabel = formatMonthLabel(currentId);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Hackathons
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto mb-8">
            Monthly virtual hackathons and in-person events. Form teams of three,
            build with Cursor, and submit your project.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/hackathons/pool"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Find a team
            </Link>
            <Link
              href="/hackathons/team"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              My team
            </Link>
          </div>
        </div>
      </section>

      {/* Virtual hackathon (current month) */}
      <section className="py-12 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">
            Virtual Hackathon – {monthLabel}
          </h2>
          <p className="text-neutral-400 mb-4">
            Runs from the 1st through the last day of the month. You must be on a
            team of exactly 3 to participate. One team member registers the
            project GitHub repo to start; at the end of the month you submit and
            lock. Commits after the 1st of the next month (Boston time) disqualify.
          </p>
          <p className="text-neutral-500 text-sm">
            Current period ends {monthEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
          </p>
        </div>
      </section>

      {/* In-person */}
      <section className="py-12 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">
            In-person hackathons
          </h2>
          <p className="text-neutral-400">
            We run in-person hackathons at select events. Same team rules apply:
            teams of 3, form in advance or at the event. Check{" "}
            <Link href="/events" className="text-emerald-400 hover:text-emerald-300 underline">
              Events
            </Link>{" "}
            for upcoming dates.
          </p>
        </div>
      </section>

      {/* Rules summary */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">
            Rules at a glance
          </h2>
          <ul className="list-disc list-inside text-neutral-400 space-y-2">
            <li>Teams must have exactly 3 members.</li>
            <li>To join the pool you need a public profile with GitHub and Discord connected (and Discord visible).</li>
            <li>You can only be on one team per hackathon.</li>
            <li>You can leave a team; if the team had already registered a repo, the team is disqualified and you cannot join another team until next month.</li>
            <li>Virtual: repo must be public and created during the hackathon month.</li>
            <li>Virtual: submit by end of month; no commits after the 1st of the next month (Boston time).</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
