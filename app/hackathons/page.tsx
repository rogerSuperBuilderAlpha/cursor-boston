import { Metadata } from "next";
import Link from "next/link";
import { getCurrentVirtualHackathonId, getMonthEndFromVirtualId } from "@/lib/hackathons";
import {
  getLumaCheckoutEventId,
  getLumaCheckoutHref,
} from "@/lib/luma-event";
import eventsData from "@/content/events.json";
import { Event, EventsData } from "@/types/events";

export const metadata: Metadata = {
  title: "Hackathons",
  description:
    "Monthly virtual hackathons and in-person events. Form teams of three, build with Cursor, and submit your project.",
};

const typedEventsData = eventsData as unknown as EventsData;

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
  const inPersonHackathons = typedEventsData.upcoming
    .filter((event: Event) => event.type === "hackathon")
    .sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  const featuredInPersonHackathon = inPersonHackathons[0];
  const featuredEmbedSrc =
    featuredInPersonHackathon?.lumaEmbedSrc ??
    (featuredInPersonHackathon?.lumaCheckoutEventId
      ? `https://luma.com/embed/event/${featuredInPersonHackathon.lumaCheckoutEventId}/simple`
      : null);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Hackathons
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
            Monthly virtual hackathons and in-person events. Form teams of three,
            build with Cursor, and submit your project.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/hackathons/pool"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Find a team
            </Link>
            <Link
              href="/hackathons/teams"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-neutral-800 text-white rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Teams
            </Link>
            <Link
              href="/hackathons/team"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-neutral-800 text-white rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              My team
            </Link>
          </div>
        </div>
      </section>

      {/* Featured in-person */}
      <section className="py-12 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Featured in-person hackathon
          </h2>

          {featuredInPersonHackathon ? (
            <div className="space-y-10 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground md:text-2xl">
                      {featuredInPersonHackathon.title}
                    </h3>
                    {featuredInPersonHackathon.subtitle && (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {featuredInPersonHackathon.subtitle}
                      </p>
                    )}
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {featuredInPersonHackathon.description}
                  </p>
                  <div className="space-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <p>
                      <span className="font-medium text-foreground">When:</span>{" "}
                      {new Date(
                        `${featuredInPersonHackathon.date}T12:00:00`
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {featuredInPersonHackathon.time &&
                      featuredInPersonHackathon.time !== "TBD"
                        ? ` • ${featuredInPersonHackathon.time}`
                        : ""}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Where:</span>{" "}
                      {featuredInPersonHackathon.venue?.name ||
                        featuredInPersonHackathon.location}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500">
                      Registration is approval-required on{" "}
                      <a
                        href={featuredInPersonHackathon.lumaUrl}
                        className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Luma
                      </a>
                      . You may be asked to verify token ownership with your wallet during checkout.
                    </p>
                  </div>
                  {featuredInPersonHackathon.perks &&
                    featuredInPersonHackathon.perks.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          Perks &amp; prizes
                        </h4>
                        <ul className="list-inside list-disc text-sm text-neutral-600 dark:text-neutral-400">
                          {featuredInPersonHackathon.perks.map((perk) => (
                            <li key={perk}>{perk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {featuredInPersonHackathon.agenda &&
                    featuredInPersonHackathon.agenda.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          Schedule
                        </h4>
                        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                          {featuredInPersonHackathon.agenda.map((item) => (
                            <li key={`${item.time}-${item.title}`}>
                              <span className="font-medium text-foreground">
                                {item.time}
                              </span>
                              {" — "}
                              {item.title}
                              {item.description ? `. ${item.description}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-foreground">
                      How spots are prioritized
                    </h4>
                    <ol className="list-inside list-decimal space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                      <li>
                        Open source: merged PRs to{" "}
                        <a
                          href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                          className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          cursor-boston on GitHub
                        </a>
                      </li>
                      <li>Completed profile on cursorboston.com</li>
                      <li>Member of the Cursor Boston Discord</li>
                      {featuredInPersonHackathon.slug ===
                      "cursor-boston-hack-a-sprint-2026" ? (
                        <>
                          <li>
                            <Link
                              href="/hackathons/hack-a-sprint-2026/signup"
                              className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
                            >
                              Website signup
                            </Link>{" "}
                            ranks you by PR count (ties broken by earlier signup)
                          </li>
                          <li>Luma registration (approval required)</li>
                        </>
                      ) : (
                        <li>Earlier sign-ups rank higher</li>
                      )}
                    </ol>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <a
                      href={getLumaCheckoutHref(featuredInPersonHackathon)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background luma-checkout--button"
                      data-luma-action="checkout"
                      data-luma-event-id={getLumaCheckoutEventId(
                        featuredInPersonHackathon
                      )}
                    >
                      Register for event
                    </a>
                    <Link
                      href={`/events/${featuredInPersonHackathon.slug}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Full event page
                    </Link>
                    <a
                      href={featuredInPersonHackathon.lumaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Open on Luma
                    </a>
                    {featuredInPersonHackathon.slug ===
                      "cursor-boston-hack-a-sprint-2026" && (
                      <>
                        <Link
                          href="/hackathons/hack-a-sprint-2026/signup"
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Website signup &amp; ranking
                        </Link>
                        <Link
                          href="/hackathons/hack-a-sprint-2026"
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Showcase &amp; voting
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {featuredEmbedSrc ? (
                  <div className="w-full shrink-0 lg:max-w-[min(100%,600px)]">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Register on Luma
                    </p>
                    <div className="overflow-hidden rounded-[4px]">
                      <iframe
                        src={featuredEmbedSrc}
                        title={`${featuredInPersonHackathon.title} — Luma`}
                        width={600}
                        height={450}
                        className="h-[min(450px,70vh)] w-full max-w-full bg-white"
                        style={{
                          border: "1px solid #bfcbda88",
                          borderRadius: 4,
                        }}
                        allow="fullscreen; payment"
                        frameBorder={0}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 dark:text-neutral-400">
              No featured in-person hackathon is listed yet.
            </p>
          )}
        </div>
      </section>

      {/* Virtual hackathon (current month) */}
      <section className="py-12 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Virtual Hackathon – {monthLabel}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
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
      <section className="py-12 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            In-person hackathons
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            We run in-person hackathons at select events. Same team rules apply:
            teams of 3, form in advance or at the event.
          </p>

          {inPersonHackathons.length > 0 ? (
            <div className="grid gap-4">
              {inPersonHackathons.map((event, index) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl">
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {event.title}
                      </h3>
                      {event.subtitle && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                          {event.subtitle}
                        </p>
                      )}
                      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                        {event.description}
                      </p>
                      <div className="space-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                        <p>{event.date}{event.time && event.time !== "TBD" ? ` • ${event.time}` : ""}</p>
                        <p>{event.venue?.name || event.location}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 md:min-w-[180px]">
                      <Link
                        href={`/events/${event.slug}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-neutral-800"
                      >
                        View details
                      </Link>
                      <a
                        href={getLumaCheckoutHref(event)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-neutral-700 dark:hover:bg-neutral-800 luma-checkout--button"
                        data-luma-action="checkout"
                        data-luma-event-id={getLumaCheckoutEventId(event)}
                      >
                        Register on Luma
                      </a>
                    </div>
                  </div>
                  {index === 0 && (
                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Featured
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-600 dark:text-neutral-400">
              No in-person hackathons are listed yet. Check{" "}
              <Link href="/events" className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline">
                Events
              </Link>{" "}
              for upcoming dates.
            </p>
          )}
        </div>
      </section>

      {/* Sponsor / host */}
      <section className="py-12 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Sponsor or host
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Interested in supporting our community? Get in touch to sponsor prizes for
            the monthly virtual hackathon or to sponsor and host an in-person hackathon.
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            Email{" "}
            <a
              href="mailto:hello@cursorboston.com"
              className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 underline"
            >
              hello@cursorboston.com
            </a>
            {" "}to sponsor prizes for the monthly hackathon or to discuss sponsoring
            and hosting an in-person hackathon.
          </p>
        </div>
      </section>

      {/* Rules summary */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Rules at a glance
          </h2>
          <ul className="list-disc list-inside text-neutral-600 dark:text-neutral-400 space-y-2">
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
