import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

// Mock next/dynamic to render children synchronously
jest.mock("next/dynamic", () => {
  return function mockDynamic(
    loader: () => Promise<{ default: React.ComponentType }>,
  ) {
    const src = loader.toString();
    const name = src.match(/mod\.(\w+)/)?.[1];

    if (name === "MapContainer") {
      return function MockMapContainer({
        children,
      }: {
        children: React.ReactNode;
      }) {
        return <div data-testid="map-container">{children}</div>;
      };
    }
    if (name === "TileLayer") {
      return function MockTileLayer() {
        return <div data-testid="tile-layer" />;
      };
    }
    if (name === "Marker") {
      return function MockMarker({
        children,
        eventHandlers,
      }: {
        children: React.ReactNode;
        eventHandlers?: { click?: () => void };
      }) {
        return (
          <div data-testid="marker" onClick={eventHandlers?.click}>
            {children}
          </div>
        );
      };
    }
    if (name === "Popup") {
      return function MockPopup({
        children,
      }: {
        children: React.ReactNode;
      }) {
        return <div data-testid="popup">{children}</div>;
      };
    }

    // Default: MarkerClusterGroup
    return function MockCluster({
      children,
    }: {
      children: React.ReactNode;
    }) {
      return <div data-testid="marker-cluster">{children}</div>;
    };
  };
});

// Mock leaflet — import() resolves to this synchronously
jest.mock("leaflet", () => ({
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: jest.fn(),
    },
  },
  DivIcon: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("leaflet/dist/leaflet.css", () => ({}));

import EventMap from "@/components/map/EventMap";
import { Event } from "@/types/events";

type MappableEvent = Event & { _upcoming: boolean };

const cambridgeEvent: MappableEvent = {
  id: "cafe-cursor-boston",
  slug: "cafe-cursor-boston",
  title: "Cafe Cursor Boston",
  date: "2026-02-17",
  time: "9:00 AM - 3:00 PM",
  location: "Cambridge, Massachusetts",
  venue: {
    name: "Caffe Nero",
    address: "100 Cambridgeside Pl, Cambridge, MA 02141",
    coordinates: { lat: 42.3677, lng: -71.0764 },
  },
  type: "meetup",
  description: "First Cursor community event in Boston.",
  image: "/test-image.png",
  lumaUrl: "https://lu.ma/test",
  lumaEventId: "test-id",
  registrationRequired: true,
  capacity: 50,
  topics: ["Co-working", "Workshops"],
  _upcoming: false,
};

const seaportEvent: MappableEvent = {
  id: "hack-night",
  slug: "hack-night",
  title: "Cursor Hack Night",
  date: "2025-11-15",
  time: "6:00 PM - 10:00 PM",
  location: "Seaport, Boston",
  venue: {
    name: "District Hall",
    address: "75 Northern Ave, Boston, MA 02210",
    coordinates: { lat: 42.3531, lng: -71.044 },
  },
  type: "hackathon",
  description: "Evening hackathon building with Cursor.",
  image: "/test-image2.png",
  lumaUrl: "https://lu.ma/test2",
  lumaEventId: "test-id-2",
  registrationRequired: true,
  capacity: 80,
  topics: ["Hackathon"],
  _upcoming: true,
};

/** Render and wait for leaflet useEffect to settle */
async function renderMap(events: MappableEvent[]) {
  const user = userEvent.setup();
  await act(async () => {
    render(<EventMap events={events} />);
  });
  // Wait for leaflet async import to resolve and markers to appear
  if (events.length > 0) {
    await waitFor(() => {
      expect(screen.getAllByTestId("marker").length).toBeGreaterThan(0);
    });
  }
  return user;
}

describe("EventMap", () => {
  describe("map view (default)", () => {
    it("renders the map container by default", async () => {
      await renderMap([cambridgeEvent]);
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });

    it("renders a marker for each event", async () => {
      await renderMap([cambridgeEvent, seaportEvent]);
      expect(screen.getAllByTestId("marker")).toHaveLength(2);
    });

    it("shows event info in popup", async () => {
      await renderMap([cambridgeEvent]);
      const popup = screen.getByTestId("popup");
      // Title and venue name are both "Cafe Cursor Boston", so use getAllByText
      expect(within(popup).getAllByText("Cafe Cursor Boston").length).toBeGreaterThanOrEqual(1);
      expect(within(popup).getByText("Luma")).toBeInTheDocument();
    });

    it("renders the legend", async () => {
      await renderMap([cambridgeEvent]);
      expect(screen.getByText("Upcoming")).toBeInTheDocument();
      expect(screen.getByText("Past")).toBeInTheDocument();
    });

    it("renders with zero events without crashing", async () => {
      await act(async () => {
        render(<EventMap events={[]} />);
      });
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    });
  });

  describe("view toggle", () => {
    it("switches to list view", async () => {
      const user = await renderMap([cambridgeEvent, seaportEvent]);

      await user.click(screen.getByRole("button", { name: "List" }));

      expect(screen.queryByTestId("map-container")).not.toBeInTheDocument();
      expect(screen.getByText("Cafe Cursor Boston")).toBeInTheDocument();
      expect(screen.getByText("Cursor Hack Night")).toBeInTheDocument();
    });

    it("switches back to map view", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByRole("button", { name: "List" }));
      await user.click(screen.getByRole("button", { name: "Map" }));

      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });
  });

  describe("neighborhood filter", () => {
    it("renders filter buttons from event data", async () => {
      await renderMap([cambridgeEvent, seaportEvent]);
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cambridge" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Seaport" })).toBeInTheDocument();
    });

    it("filters markers by neighborhood", async () => {
      const user = await renderMap([cambridgeEvent, seaportEvent]);

      expect(screen.getAllByTestId("marker")).toHaveLength(2);

      await user.click(screen.getByRole("button", { name: "Cambridge" }));
      expect(screen.getAllByTestId("marker")).toHaveLength(1);
    });

    it("deselects neighborhood on second click", async () => {
      const user = await renderMap([cambridgeEvent, seaportEvent]);

      await user.click(screen.getByRole("button", { name: "Cambridge" }));
      expect(screen.getAllByTestId("marker")).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Cambridge" }));
      expect(screen.getAllByTestId("marker")).toHaveLength(2);
    });

    it("filters list view too", async () => {
      const user = await renderMap([cambridgeEvent, seaportEvent]);

      await user.click(screen.getByRole("button", { name: "List" }));
      await user.click(screen.getByRole("button", { name: "Seaport" }));

      expect(screen.queryByText("Cafe Cursor Boston")).not.toBeInTheDocument();
      expect(screen.getByText("Cursor Hack Night")).toBeInTheDocument();
    });
  });

  describe("detail panel", () => {
    it("opens when a marker is clicked", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByTestId("marker"));
      // Detail panel renders twice (desktop sidebar + mobile bottom sheet)
      const dirLinks = screen.getAllByText("Get Directions");
      expect(dirLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("shows event image", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByTestId("marker"));
      const images = screen.getAllByRole("img");
      expect(images.some((img) => img.getAttribute("alt") === "Cafe Cursor Boston")).toBe(true);
    });

    it("directions link points to Google Maps with coordinates", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByTestId("marker"));
      const links = screen.getAllByText("Get Directions");
      const link = links[0].closest("a");
      expect(link).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir"));
      expect(link).toHaveAttribute("href", expect.stringContaining("42.3677"));
    });

    it("shows capacity", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByTestId("marker"));
      // Capacity appears in popup and detail panels
      const capacityElements = screen.getAllByText(/Capacity: 50/);
      expect(capacityElements.length).toBeGreaterThanOrEqual(1);
    });

    it("shows topics", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByTestId("marker"));
      const coworking = screen.getAllByText("Co-working");
      const workshops = screen.getAllByText("Workshops");
      expect(coworking.length).toBeGreaterThanOrEqual(1);
      expect(workshops.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Also at this venue" for events sharing a venue', async () => {
      const sameVenueEvent: MappableEvent = {
        ...cambridgeEvent,
        id: "second-event",
        slug: "second-event",
        title: "Second Event Here",
        date: "2026-03-01",
      };
      const user = await renderMap([cambridgeEvent, sameVenueEvent]);

      const markers = screen.getAllByTestId("marker");
      await user.click(markers[0]);

      const alsoLabels = screen.getAllByText("Also at this venue");
      expect(alsoLabels.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Second Event Here/).length).toBeGreaterThanOrEqual(1);
    });

    it("closes when close button is clicked", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByTestId("marker"));
      expect(screen.getAllByText("Get Directions").length).toBeGreaterThanOrEqual(1);

      await user.click(screen.getByRole("button", { name: "Close details" }));
      // After closing, "Get Directions" should not appear in detail panels
      // (popup text may still be present but the detail panel is gone)
      await waitFor(() => {
        const remaining = screen.queryAllByText("Get Directions");
        // Only popup might remain, but no detail panel
        expect(remaining.length).toBeLessThan(
          screen.getAllByTestId("marker").length + 1
        );
      });
    });

    it("hides capacity when not provided", async () => {
      const noCapacity = { ...cambridgeEvent, capacity: undefined };
      const user = await renderMap([noCapacity]);

      await user.click(screen.getByTestId("marker"));
      expect(screen.queryByText(/Capacity:/)).not.toBeInTheDocument();
    });
  });

  describe("list view cards", () => {
    it("renders event cards with image and actions", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByRole("button", { name: "List" }));

      expect(screen.getByText("Cafe Cursor Boston")).toBeInTheDocument();
      expect(screen.getByText("Details")).toBeInTheDocument();
      expect(screen.getByText("Luma")).toBeInTheDocument();
    });

    it("has a directions button", async () => {
      const user = await renderMap([cambridgeEvent]);

      await user.click(screen.getByRole("button", { name: "List" }));

      const dirLink = screen.getByRole("link", { name: "Get directions" });
      expect(dirLink).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir"));
    });

    it("shows green badge for upcoming, blue for past", async () => {
      const user = await renderMap([cambridgeEvent, seaportEvent]);

      await user.click(screen.getByRole("button", { name: "List" }));

      const pastBadge = screen.getByText("meetup");
      expect(pastBadge.className).toContain("bg-blue-500");

      const upcomingBadge = screen.getByText("hackathon");
      expect(upcomingBadge.className).toContain("bg-emerald-500");
    });
  });
});
