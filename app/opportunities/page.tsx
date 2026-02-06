import { Metadata } from "next";
import opportunitiesData from "@/content/opportunities.json";

export const metadata: Metadata = {
  title: "Opportunities",
  description:
    "Jobs, co-founder roles, and equity opportunities from the Cursor Boston community. Find your next venture or hire from our network.",
  alternates: {
    canonical: "https://cursorboston.com/opportunities",
  },
};

const opportunityTypes = [
  {
    name: "Co-Founder",
    description: "Join an early-stage team and build something from the ground up",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: "Full-Time",
    description: "Salaried positions at startups and companies in Boston",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    name: "Contract",
    description: "Freelance and project-based work for skilled developers",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    name: "Equity",
    description: "Opportunities offering ownership stakes in early-stage ventures",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

function getTypeBadgeColor(type: string) {
  switch (type) {
    case "cofounder":
      return "bg-purple-500/10 text-purple-400";
    case "full-time":
      return "bg-emerald-500/10 text-emerald-400";
    case "contract":
      return "bg-blue-500/10 text-blue-400";
    case "internship":
      return "bg-amber-500/10 text-amber-400";
    default:
      return "bg-neutral-500/10 text-neutral-400";
  }
}

function formatType(type: string) {
  switch (type) {
    case "cofounder":
      return "Co-Founder";
    case "full-time":
      return "Full-Time";
    case "part-time":
      return "Part-Time";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

export default function OpportunitiesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Opportunities
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Jobs, co-founder roles, and equity opportunities from the Cursor
            Boston community. Build the future with Boston&apos;s best.
          </p>
        </div>
      </section>

      {/* Opportunity Types */}
      <section className="py-12 px-6 bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
            Opportunity Types
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {opportunityTypes.map((type) => (
              <div
                key={type.name}
                className="flex items-start gap-4 p-4 bg-neutral-900 rounded-xl border border-neutral-800"
              >
                <div className="text-neutral-400">{type.icon}</div>
                <div>
                  <h3 className="text-white font-medium mb-1">{type.name}</h3>
                  <p className="text-neutral-400 text-sm">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Open Opportunities
            </h2>
          </div>

          {opportunitiesData.opportunities.length > 0 ? (
            <div className="grid gap-8">
              {opportunitiesData.opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800"
                >
                  <div className="p-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span
                            className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getTypeBadgeColor(opp.type)}`}
                          >
                            {formatType(opp.type)}
                          </span>
                          {opp.featured && (
                            <span className="inline-block px-3 py-1 bg-amber-500/10 text-amber-400 text-sm font-medium rounded-full">
                              Featured
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-1">
                          {opp.title}
                        </h3>
                        <p className="text-lg text-emerald-400 font-semibold">
                          {opp.company}
                        </p>
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 mb-6">
                      <div className="flex items-center gap-2 text-neutral-300 text-sm">
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
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{opp.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-300 text-sm">
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
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <span>{opp.compensation}</span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-300 text-sm">
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
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>Posted {opp.postedDate}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                      <p className="text-neutral-300 leading-relaxed">
                        {opp.description}
                      </p>
                    </div>

                    {/* About the Company */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                        About {opp.company}
                      </h4>
                      <p className="text-neutral-300 leading-relaxed">
                        {opp.aboutCompany}
                      </p>
                    </div>

                    {/* Team */}
                    {opp.team && opp.team.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                          The Team
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-4">
                          {opp.team.map((member) => (
                            <div
                              key={member.name}
                              className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700/50"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-white font-semibold">
                                  {member.name}
                                </span>
                                <span className="text-neutral-500">&middot;</span>
                                <span className="text-emerald-400 text-sm font-medium">
                                  {member.role}
                                </span>
                              </div>
                              <p className="text-neutral-400 text-sm leading-relaxed">
                                {member.bio}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {opp.tags && opp.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {opp.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-neutral-800 text-neutral-300 text-sm rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-800">
              <p className="text-neutral-400 mb-4">
                No opportunities posted yet. Check back soon!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Post Opportunity CTA */}
      <section className="py-16 px-6 bg-neutral-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Have an Opportunity to Share?
          </h2>
          <p className="text-neutral-400 mb-6">
            Looking for a co-founder, hiring for your startup, or have a
            freelance gig? Share it with the Cursor Boston community.
          </p>
          <a
            href="https://discord.gg/Wsncg8YYqc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Post on Discord (opens in new tab)"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Post on Discord
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
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
