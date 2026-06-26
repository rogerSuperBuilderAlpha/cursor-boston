/**
 * @jest-environment node
 */
import {
  BOSTON_MAP_CENTER,
  buildEventMapEntry,
  getEventMapMarkers,
  getMapBounds,
  resolveEventCoordinates,
} from "@/lib/events-map";
import type { Event } from "@/types/events";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "evt-1",
    slug: "sample-meetup",
    title: "Sample Meetup",
    date: "2026-06-15",
    time: "6:00 PM",
    location: "Cambridge, MA",
    type: "meetup",
    description: "A community meetup.",
    image: "/events/sample.png",
    lumaUrl: "https://lu.ma/sample",
    lumaEventId: "sample-id",
    registrationRequired: true,
    ...overrides,
  } as Event;
}

describe("events-map", () => {
  describe("resolveEventCoordinates", () => {
    it("returns explicit venue coordinates when present", () => {
      const event = makeEvent({
        venue: {
          name: "Caffe Nero",
          address: "100 Cambridgeside Pl, Cambridge, MA 02141",
          coordinates: { lat: 42.3677, lng: -71.0764 },
        },
      });

      expect(resolveEventCoordinates(event)).toEqual({ lat: 42.3677, lng: -71.0764 });
    });

    it("falls back to known Microsoft NERD coordinates", () => {
      const event = makeEvent({
        venue: {
          name: "Microsoft New England Research and Development Center",
          address: "1 Memorial Dr, Cambridge, MA 02142",
        },
      });

      expect(resolveEventCoordinates(event)).toEqual({ lat: 42.361145, lng: -71.085301 });
    });

    it("falls back to Back Bay when location mentions Back Bay", () => {
      const event = makeEvent({
        location: "Back Bay, Boston, MA",
        venue: {
          name: "Back Bay (exact address after approval)",
          address: "Register on Luma to see the venue address after you're approved.",
        },
      });

      expect(resolveEventCoordinates(event)).toEqual({ lat: 42.3502, lng: -71.0759 });
    });

    it("returns null when no coordinates can be resolved", () => {
      const event = makeEvent({
        location: "Remote",
        venue: {
          name: "Online",
          address: "Zoom",
        },
      });

      expect(resolveEventCoordinates(event)).toBeNull();
    });
  });

  describe("buildEventMapEntry", () => {
    it("builds a marker with event metadata", () => {
      const event = makeEvent({
        id: "cafe-cursor",
        slug: "cafe-cursor-boston",
        venue: {
          name: "Caffe Nero",
          address: "100 Cambridgeside Pl, Cambridge, MA 02141",
          coordinates: { lat: 42.3677, lng: -71.0764 },
        },
      });

      const entry = buildEventMapEntry(event);
      expect(entry.marker).toMatchObject({
        eventId: "cafe-cursor",
        slug: "cafe-cursor-boston",
        href: "/events/cafe-cursor-boston",
        lat: 42.3677,
        lng: -71.0764,
      });
    });

    it("returns null marker when coordinates are unavailable", () => {
      const entry = buildEventMapEntry(
        makeEvent({
          venue: {
            name: "Online",
            address: "Zoom",
          },
        })
      );

      expect(entry.marker).toBeNull();
    });
  });

  describe("getEventMapMarkers", () => {
    it("filters to mappable events only", () => {
      const markers = getEventMapMarkers([
        makeEvent({
          id: "mapped",
          venue: {
            name: "Moderna HQ",
            address: "325 Binney St, Cambridge, MA 02142",
          },
        }),
        makeEvent({
          id: "unmapped",
          venue: {
            name: "Online",
            address: "Zoom",
          },
        }),
      ]);

      expect(markers).toHaveLength(1);
      expect(markers[0]?.eventId).toBe("mapped");
    });
  });

  describe("getMapBounds", () => {
    it("returns null for an empty marker list", () => {
      expect(getMapBounds([])).toBeNull();
    });

    it("computes bounds that include all markers", () => {
      const bounds = getMapBounds([
        {
          eventId: "a",
          slug: "a",
          title: "A",
          date: "2026-01-01",
          time: "1 PM",
          type: "meetup",
          location: "Boston",
          venueName: "Venue A",
          venueAddress: "Address A",
          lat: 42.36,
          lng: -71.08,
          href: "/events/a",
          isPast: false,
        },
        {
          eventId: "b",
          slug: "b",
          title: "B",
          date: "2026-02-01",
          time: "2 PM",
          type: "meetup",
          location: "Boston",
          venueName: "Venue B",
          venueAddress: "Address B",
          lat: 42.37,
          lng: -71.07,
          href: "/events/b",
          isPast: true,
        },
      ]);

      expect(bounds).toEqual([
        [42.36, -71.08],
        [42.37, -71.07],
      ]);
    });
  });

  it("exposes a Boston default center", () => {
    expect(BOSTON_MAP_CENTER.lat).toBeCloseTo(42.36, 1);
    expect(BOSTON_MAP_CENTER.lng).toBeCloseTo(-71.06, 1);
  });
});
