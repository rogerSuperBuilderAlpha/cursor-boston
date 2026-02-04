import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import eventsData from "@/content/events.json";
import CoworkingSlots from "@/components/events/CoworkingSlots";

// Type definitions for event data
interface AgendaItem {
  time: string;
  title: string;
  description: string;
}

interface Speaker {
  name: string;
  role: string;
  company?: string;
  image?: string;
  bio?: string;
}

interface Sponsor {
  name: string;
  logo: string;
  url?: string;
  tier?: "gold" | "silver" | "bronze" | "community";
}

interface FAQ {
  question: string;
  answer: string;
}

interface Venue {
  name: string;
  address: string;
  mapUrl?: string | null;
}

interface CoworkingInfo {
  description: string;
  sessionsPerDay: number;
  hoursPerSession: number;
  slotsPerSession: number;
  startTime: string;
  endTime: string;
}

interface Event {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  time: string;
  location: string;
  venue?: Venue;
  type: string;
  description: string;
  longDescription?: string;
  image: string;
  lumaUrl: string;
  lumaEventId: string;
  registrationRequired: boolean;
  capacity?: number;
  perks?: string[];
  topics?: string[];
  agenda?: AgendaItem[];
  speakers?: Speaker[];
  sponsors?: Sponsor[];
  faq?: FAQ[];
  whatToBring?: string[];
  featured?: boolean;
  hasCoworking?: boolean;
  coworkingInfo?: CoworkingInfo;
}

// Get all events (upcoming + past) for static generation
function getAllEvents(): Event[] {
  return [
    ...(eventsData.upcoming as Event[]),
    ...(eventsData.past as Event[]),
  ];
}

// Find event by slug
function getEventBySlug(slug: string): Event | undefined {
  return getAllEvents().find((event) => event.slug === slug);
}

// Generate static paths for all events
export async function generateStaticParams() {
  const events = getAllEvents();
  return events.map((event) => ({
    slug: event.slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) {
    return {
      title: "Event Not Found",
    };
  }

  return {
    title: `${event.title} | Cursor Boston Events`,
    description: event.description,
    openGraph: {
      title: event.title,
      description: event.description,
      images: [
        {
          url: `https://cursorboston.com${event.image}`,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: event.description,
      images: [`https://cursorboston.com${event.image}`],
    },
    alternates: {
      canonical: `https://cursorboston.com/events/${event.slug}`,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  // Generate JSON-LD structured data
  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue?.name || event.location,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venue?.address,
        addressLocality: "Boston",
        addressRegion: "MA",
        addressCountry: "US",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Cursor Boston",
      url: "https://cursorboston.com",
    },
    image: `https://cursorboston.com${event.image}`,
    url: `https://cursorboston.com/events/${event.slug}`,
    ...(event.capacity && { maximumAttendeeCapacity: event.capacity }),
  };

  return (
    <div className="flex flex-col">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd),
        }}
      />

      {/* Breadcrumb */}
      <nav className="px-6 py-4 border-b border-neutral-800" aria-label="Breadcrumb">
        <div className="max-w-6xl mx-auto">
          <ol className="flex items-center gap-2 text-sm text-neutral-400">
            <li>
              <Link href="/events" className="hover:text-white transition-colors">
                Events
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-white truncate">{event.title}</li>
          </ol>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative">
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Event Image */}
          <div className="relative aspect-square lg:aspect-auto lg:min-h-[600px] bg-neutral-900">
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-contain"
              priority
            />
            {/* QR Code */}
            <div className="absolute bottom-4 right-4 w-24 h-24 bg-white p-1 rounded-lg shadow-lg">
              <Image
                src="/luma-qr.png"
                alt="Scan to register"
                fill
                className="object-contain"
              />
            </div>
          </div>

          {/* Event Info */}
          <div className="p-8 lg:p-12 flex flex-col justify-center bg-neutral-950">
            <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-full mb-4 w-fit capitalize">
              {event.type}
            </span>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
              {event.title}
            </h1>
            
            {event.subtitle && (
              <p className="text-xl text-neutral-400 mb-6">{event.subtitle}</p>
            )}

            {/* Key Details */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-neutral-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="font-medium">{event.date}</span>
                {event.time && event.time !== "TBD" && (
                  <>
                    <span className="text-neutral-600">•</span>
                    <span>{event.time}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-neutral-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-500"
                  aria-hidden="true"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{event.venue?.name || event.location}</span>
              </div>

              {event.capacity && (
                <div className="flex items-center gap-3 text-neutral-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-500"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Limited to {event.capacity} attendees</span>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <a
              href={event.lumaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-lg text-base font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black w-full sm:w-auto luma-checkout--button"
              data-luma-action="checkout"
              data-luma-event-id={event.lumaEventId}
            >
              Register on Luma
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
            About This Event
          </h2>
          <div className="prose prose-invert prose-lg max-w-none">
            {event.longDescription ? (
              event.longDescription.split("\n\n").map((paragraph, index) => (
                <p key={index} className="text-neutral-300 leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="text-neutral-300 leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Topics */}
          {event.topics && event.topics.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                Topics Covered
              </h3>
              <div className="flex flex-wrap gap-2">
                {event.topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-full"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Coworking Slots Section */}
      {event.hasCoworking && (
        <section className="py-16 px-6 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-400"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Coworking Sessions
              </h2>
            </div>
            {event.coworkingInfo && (
              <p className="text-neutral-400 mb-8 max-w-2xl">
                {event.coworkingInfo.description}
              </p>
            )}
            <CoworkingSlots eventId={event.id} />
          </div>
        </section>
      )}

      {/* Agenda Section */}
      {event.agenda && event.agenda.length > 0 && (
        <section className="py-16 px-6 bg-neutral-950 border-b border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
              Agenda
            </h2>
            <div className="space-y-6">
              {event.agenda.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-6 p-6 bg-neutral-900 rounded-xl border border-neutral-800"
                >
                  <div className="text-emerald-400 font-mono text-sm whitespace-nowrap">
                    {item.time}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                    <p className="text-neutral-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Speakers Section */}
      {event.speakers && event.speakers.length > 0 && (
        <section className="py-16 px-6 border-b border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
              Speakers
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {event.speakers.map((speaker, index) => (
                <div
                  key={index}
                  className="p-6 bg-neutral-900 rounded-xl border border-neutral-800 text-center"
                >
                  {speaker.image && (
                    <div className="relative w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-neutral-800">
                      <Image
                        src={speaker.image}
                        alt={speaker.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <h3 className="text-white font-semibold text-lg">{speaker.name}</h3>
                  <p className="text-neutral-400 text-sm">{speaker.role}</p>
                  {speaker.company && (
                    <p className="text-neutral-500 text-sm">{speaker.company}</p>
                  )}
                  {speaker.bio && (
                    <p className="text-neutral-400 text-sm mt-3">{speaker.bio}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* What to Bring Section */}
      {event.whatToBring && event.whatToBring.length > 0 && (
        <section className="py-16 px-6 bg-neutral-950 border-b border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
              What to Bring
            </h2>
            <ul className="grid sm:grid-cols-2 gap-4">
              {event.whatToBring.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 p-4 bg-neutral-900 rounded-lg border border-neutral-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-400 flex-shrink-0"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-neutral-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Perks Section */}
      {event.perks && event.perks.length > 0 && (
        <section className="py-16 px-6 border-b border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
              Event Perks
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {event.perks.map((perk, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center gap-3 p-6 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/20 text-center"
                >
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
                    className="text-emerald-400"
                    aria-hidden="true"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-white font-medium">{perk}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {event.faq && event.faq.length > 0 && (
        <section className="py-16 px-6 bg-neutral-950 border-b border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {event.faq.map((item, index) => (
                <details
                  key={index}
                  className="group bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <h3 className="text-white font-medium pr-4">{item.question}</h3>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-neutral-400 group-open:rotate-180 transition-transform flex-shrink-0"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 text-neutral-400">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sponsors Section */}
      {event.sponsors && event.sponsors.length > 0 && (
        <section className="py-16 px-6 border-b border-neutral-800">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">
              Sponsors
            </h2>
            <div className="flex flex-wrap justify-center items-center gap-8">
              {event.sponsors.map((sponsor, index) => (
                <a
                  key={index}
                  href={sponsor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors"
                >
                  <Image
                    src={sponsor.logo}
                    alt={sponsor.name}
                    width={120}
                    height={60}
                    className="object-contain opacity-80 hover:opacity-100 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Join Us?
          </h2>
          <p className="text-neutral-400 text-lg mb-8">
            Don&apos;t miss out on this event. Spots are limited!
          </p>
          <a
            href={event.lumaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-lg text-lg font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black luma-checkout--button"
            data-luma-action="checkout"
            data-luma-event-id={event.lumaEventId}
          >
            Register Now on Luma
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
