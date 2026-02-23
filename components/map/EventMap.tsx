"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Event, formatEventDate, getEventUrl } from "@/types/events";
import dynamic from "next/dynamic";

// Dynamically import react-leaflet to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-cluster"),
  { ssr: false }
);

type MappableEvent = Event & { _upcoming: boolean };

interface EventMapProps {
  events: MappableEvent[];
}

function getNeighborhood(event: MappableEvent): string {
  const loc = event.location.toLowerCase();
  const venueName = event.venue?.name?.toLowerCase() ?? "";
  const address = event.venue?.address?.toLowerCase() ?? "";

  if (
    loc.includes("cambridge") ||
    address.includes("cambridge") ||
    venueName.includes("mit") ||
    venueName.includes("cic")
  )
    return "Cambridge";
  if (
    loc.includes("seaport") ||
    address.includes("northern ave") ||
    venueName.includes("district hall")
  )
    return "Seaport";
  if (loc.includes("back bay") || address.includes("back bay"))
    return "Back Bay";
  if (loc.includes("south boston") || address.includes("south boston"))
    return "South Boston";
  return "Boston";
}

function getDirectionsUrl(event: MappableEvent): string {
  if (event.venue?.coordinates) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.venue.coordinates.lat},${event.venue.coordinates.lng}`;
  }
  const address = event.venue?.address || event.location;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export default function EventMap({ events }: EventMapProps) {
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<
    string | null
  >(null);
  const [selectedEvent, setSelectedEvent] = useState<MappableEvent | null>(
    null
  );
  const [leafletReady, setLeafletReady] = useState(false);
  const [leafletModule, setLeafletModule] =
    useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    // @ts-expect-error -- CSS module has no type declarations
    import("leaflet/dist/leaflet.css");
    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setLeafletModule(L);
      setLeafletReady(true);
    });
  }, []);

  const neighborhoods = useMemo(() => {
    const hoods = new Set(events.map(getNeighborhood));
    return Array.from(hoods).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!selectedNeighborhood) return events;
    return events.filter(
      (e) => getNeighborhood(e) === selectedNeighborhood
    );
  }, [events, selectedNeighborhood]);

  const createIcon = useMemo(() => {
    if (!leafletModule) return null;
    return (color: string) =>
      new leafletModule.DivIcon({
        className: "custom-marker",
        html: `<div style="
          width: 28px; height: 28px;
          border-radius: 50% 50% 50% 0;
          background: ${color};
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });
  }, [leafletModule]);

  return (
    <div className="flex flex-col">
      {/* Controls bar */}
      <div className="max-w-6xl mx-auto w-full px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Neighborhood filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedNeighborhood(null)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                !selectedNeighborhood
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              All
            </button>
            {neighborhoods.map((hood) => (
              <button
                key={hood}
                onClick={() =>
                  setSelectedNeighborhood(
                    hood === selectedNeighborhood ? null : hood
                  )
                }
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  selectedNeighborhood === hood
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                {hood}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1 border border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setView("map")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === "map"
                  ? "bg-white dark:bg-neutral-800 text-foreground shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === "list"
                  ? "bg-white dark:bg-neutral-800 text-foreground shadow-sm"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {view === "map" ? (
        <div className="relative">
          {/* Map — full width, tall on mobile for immersion */}
          <div className="w-full h-[calc(100vh-280px)] min-h-[400px] lg:h-[600px] relative">
            {leafletReady ? (
              <MapContainer
                center={[42.3601, -71.0589]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MarkerClusterGroup
                  chunkedLoading
                  maxClusterRadius={40}
                  spiderfyOnMaxZoom
                  showCoverageOnHover={false}
                >
                  {filteredEvents.map((event) => {
                    if (!event.venue?.coordinates || !createIcon) return null;
                    const icon = createIcon(
                      event._upcoming ? "#10b981" : "#3b82f6"
                    );
                    return (
                      <Marker
                        key={event.id}
                        position={[
                          event.venue.coordinates.lat,
                          event.venue.coordinates.lng,
                        ]}
                        icon={icon}
                        eventHandlers={{
                          click: () => setSelectedEvent(event),
                        }}
                      >
                        <Popup>
                          <div className="min-w-[200px]">
                            <p className="font-semibold text-sm mb-1">
                              {event.title}
                            </p>
                            <p className="text-xs text-gray-600 mb-1">
                              {formatEventDate(event.date)} &middot;{" "}
                              {event.time}
                            </p>
                            <p className="text-xs text-gray-500 mb-1">
                              {event.venue?.name}
                            </p>
                            <p className="text-xs text-gray-500 mb-2">
                              {event.venue?.address}
                            </p>
                            {event.capacity && (
                              <p className="text-xs text-gray-500 mb-2">
                                Capacity: {event.capacity}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <a
                                href={`/events/${event.slug}`}
                                className="text-xs text-emerald-600 font-medium hover:underline"
                              >
                                View Event
                              </a>
                              <a
                                href={event.lumaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 font-medium hover:underline"
                              >
                                Luma
                              </a>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MarkerClusterGroup>
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
                <div className="text-neutral-500 dark:text-neutral-400 text-sm">
                  Loading map...
                </div>
              </div>
            )}

            {/* Legend overlay on map */}
            <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-4 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Upcoming
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Past
              </div>
            </div>
          </div>

          {/* Desktop sidebar */}
          {selectedEvent && (
            <div className="hidden lg:block absolute top-4 right-4 z-[1000] w-80">
              <EventDetailPanel
                event={selectedEvent}
                allEvents={events}
                onClose={() => setSelectedEvent(null)}
              />
            </div>
          )}

          {/* Mobile bottom sheet */}
          {selectedEvent && (
            <div className="lg:hidden fixed inset-x-0 bottom-0 z-[1000]">
              <div
                className="absolute inset-0 -top-screen"
                onClick={() => setSelectedEvent(null)}
              />
              <div className="relative bg-white dark:bg-neutral-900 rounded-t-2xl border-t border-neutral-200 dark:border-neutral-800 shadow-2xl max-h-[60vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-neutral-900 pt-3 pb-1 flex justify-center">
                  <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full" />
                </div>
                <div className="px-5 pb-6">
                  <EventDetailPanel
                    event={selectedEvent}
                    allEvents={events}
                    onClose={() => setSelectedEvent(null)}
                    inline
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="max-w-6xl mx-auto w-full px-6 pb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {filteredEvents.length === 0 && (
              <div className="col-span-full bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center py-12 text-neutral-500 dark:text-neutral-400">
                No events in this area yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sidebar / bottom sheet detail panel for a selected event */
function EventDetailPanel({
  event,
  allEvents,
  onClose,
  inline,
}: {
  event: MappableEvent;
  allEvents: MappableEvent[];
  onClose: () => void;
  inline?: boolean;
}) {
  // Find other events at the same venue
  const otherEventsAtVenue = allEvents.filter(
    (e) =>
      e.id !== event.id &&
      e.venue?.name &&
      event.venue?.name &&
      e.venue.name === event.venue.name
  );

  const directionsUrl = getDirectionsUrl(event);

  const content = (
    <>
      <div className="flex items-start justify-between mb-3">
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
            event._upcoming
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          }`}
        >
          {event._upcoming ? "Upcoming" : "Past"}
        </span>
        {!inline && (
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
            aria-label="Close details"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Event photo */}
      {event.image && (
        <div className="relative w-full h-32 rounded-lg overflow-hidden mb-3 bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      <h3 className="text-lg font-semibold text-foreground mb-2">
        {event.title}
      </h3>

      <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatEventDate(event.date)}
        </div>
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {event.time}
        </div>
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{event.venue?.name}</span>
        </div>
        <p className="text-xs pl-5">{event.venue?.address}</p>
        {event.capacity && (
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Capacity: {event.capacity}
          </div>
        )}
      </div>

      {/* Transit directions */}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline mb-4"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
        Get Directions
      </a>

      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-3">
        {event.description}
      </p>

      {event.topics && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {event.topics.map((topic) => (
            <span
              key={topic}
              className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs rounded-full"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Past events at this venue */}
      {otherEventsAtVenue.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Also at this venue
          </p>
          <div className="space-y-1.5">
            {otherEventsAtVenue.map((e) => (
              <Link
                key={e.id}
                href={getEventUrl(e)}
                className="block text-sm text-neutral-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {e.title}{" "}
                <span className="text-xs text-neutral-400">
                  &middot; {formatEventDate(e.date)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Link
          href={getEventUrl(event)}
          className="flex-1 text-center px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
        >
          View Event
        </Link>
        <a
          href={event.lumaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Luma
        </a>
      </div>
    </>
  );

  if (inline) return content;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-lg max-h-[calc(100vh-320px)] overflow-y-auto">
      {content}
    </div>
  );
}

function EventCard({ event }: { event: MappableEvent }) {
  const directionsUrl = getDirectionsUrl(event);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Event image */}
      {event.image && (
        <div className="relative w-full h-36 bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover"
          />
          <span
            className={`absolute top-3 left-3 inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
              event._upcoming
                ? "bg-emerald-500 text-white"
                : "bg-blue-500 text-white"
            }`}
          >
            {event.type}
          </span>
        </div>
      )}

      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {event.title}
        </h3>

        <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-3 space-y-1">
          <p>{formatEventDate(event.date)}</p>
          <p>{event.venue?.name} &middot; {event.location}</p>
          {event.capacity && <p>Capacity: {event.capacity}</p>}
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">
          {event.description}
        </p>

        <div className="flex gap-2">
          <Link
            href={getEventUrl(event)}
            className="flex-1 text-center px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-medium hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
          >
            Details
          </Link>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Get directions"
            title="Get Directions"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </a>
          <a
            href={event.lumaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Luma
          </a>
        </div>
      </div>
    </div>
  );
}
