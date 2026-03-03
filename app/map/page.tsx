import { Metadata } from "next";
import Link from "next/link";
import eventsData from "@/content/events.json";
import { Event, EventsData } from "@/types/events";
import EventMap from "@/components/map/EventMap";

const typedEventsData = eventsData as unknown as EventsData;

export const metadata: Metadata = {
  title: "Event Map",
  description:
    "Explore Cursor Boston event venues across the city. Find upcoming and past events on an interactive map.",
  alternates: {
    canonical: "https://cursorboston.com/map",
  },
};

export default function MapPage() {
  const allEvents = [
    ...typedEventsData.upcoming.map((e) => ({ ...e, _upcoming: true })),
    ...typedEventsData.past.map((e) => ({ ...e, _upcoming: false })),
  ] as (Event & { _upcoming: boolean })[];

  // Only include events with venue coordinates
  const mappableEvents = allEvents.filter(
    (e) => e.venue?.coordinates?.lat && e.venue?.coordinates?.lng
  );

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Event Map
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-6">
            Discover where Cursor Boston events happen across the city. Green
            pins are upcoming events, blue pins are past events.
          </p>
          <Link
            href="/events"
            className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm font-medium"
          >
            &larr; Back to Events
          </Link>
        </div>
      </section>

      {/* Map */}
      <section className="flex-1">
        <EventMap events={mappableEvents} />
      </section>
    </div>
  );
}
