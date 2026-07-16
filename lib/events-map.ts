/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getEventUrl, isEventPast, type Event } from "@/types/events";

export interface EventMapMarker {
  eventId: string;
  slug: string;
  title: string;
  date: string;
  time: string;
  type: Event["type"];
  location: string;
  venueName: string;
  venueAddress: string;
  lat: number;
  lng: number;
  href: string;
  isPast: boolean;
}

export interface EventMapEntry {
  event: Event;
  marker: EventMapMarker | null;
}

/** Default viewport when no markers are available. */
export const BOSTON_MAP_CENTER = { lat: 42.3601, lng: -71.0589 } as const;
export const BOSTON_MAP_DEFAULT_ZOOM = 12;

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const CARTO_TILE_URLS = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

export function getCartoAttribution(): string {
  return CARTO_ATTRIBUTION;
}

interface CoordinatePair {
  lat: number;
  lng: number;
}

/** Fallback coordinates for venues whose event JSON omits explicit coordinates. */
const VENUE_COORDINATE_FALLBACKS: ReadonlyArray<{
  match: (event: Event) => boolean;
  coordinates: CoordinatePair;
}> = [
  {
    match: (event) =>
      event.venue?.address.includes("1 Memorial Dr") === true ||
      event.venue?.name.includes("Microsoft") === true,
    coordinates: { lat: 42.361145, lng: -71.085301 },
  },
  {
    match: (event) => event.venue?.address.includes("325 Binney St") === true,
    coordinates: { lat: 42.3659, lng: -71.0796 },
  },
  {
    match: (event) =>
      event.venue?.name.toLowerCase().includes("hult") === true ||
      event.slug.includes("sports-hack") === true,
    coordinates: { lat: 42.3735, lng: -71.0738 },
  },
  {
    match: (event) => event.location.toLowerCase().includes("back bay") === true,
    coordinates: { lat: 42.3502, lng: -71.0759 },
  },
  {
    match: (event) => event.venue?.address.includes("100 Cambridgeside Pl") === true,
    coordinates: { lat: 42.3677, lng: -71.0764 },
  },
];

function isValidCoordinate(value: unknown): value is CoordinatePair {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as CoordinatePair;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function resolveEventCoordinates(event: Event): CoordinatePair | null {
  if (isValidCoordinate(event.venue?.coordinates)) {
    return event.venue.coordinates;
  }

  for (const fallback of VENUE_COORDINATE_FALLBACKS) {
    if (fallback.match(event)) {
      return fallback.coordinates;
    }
  }

  return null;
}

export function buildEventMapEntry(event: Event): EventMapEntry {
  const coordinates = resolveEventCoordinates(event);
  if (!coordinates) {
    return { event, marker: null };
  }

  const venueName = event.venue?.name ?? event.location;
  const venueAddress = event.venue?.address ?? event.location;

  return {
    event,
    marker: {
      eventId: event.id,
      slug: event.slug,
      title: event.title,
      date: event.date,
      time: event.time,
      type: event.type,
      location: event.location,
      venueName,
      venueAddress,
      lat: coordinates.lat,
      lng: coordinates.lng,
      href: getEventUrl(event),
      isPast: isEventPast(event),
    },
  };
}

export function buildEventMapEntries(events: readonly Event[]): EventMapEntry[] {
  return events.map(buildEventMapEntry);
}

export function getEventMapMarkers(events: readonly Event[]): EventMapMarker[] {
  return buildEventMapEntries(events)
    .map((entry) => entry.marker)
    .filter((marker): marker is EventMapMarker => marker !== null);
}

export function getMapBounds(
  markers: readonly EventMapMarker[]
): [[number, number], [number, number]] | null {
  if (markers.length === 0) return null;

  let minLat = markers[0].lat;
  let maxLat = markers[0].lat;
  let minLng = markers[0].lng;
  let maxLng = markers[0].lng;

  for (const marker of markers.slice(1)) {
    minLat = Math.min(minLat, marker.lat);
    maxLat = Math.max(maxLat, marker.lat);
    minLng = Math.min(minLng, marker.lng);
    maxLng = Math.max(maxLng, marker.lng);
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
