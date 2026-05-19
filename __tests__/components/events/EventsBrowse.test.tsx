import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Event } from "@/types/events";
import { PYDATA_2026_EVENT_SLUG } from "@/lib/pydata-2026";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock("@/components/events/PyDataLumaButton", () => ({
  PyDataLumaButton: ({ label }: { label: string }) => (
    <button type="button">{label}</button>
  ),
}));

import { EventsBrowse } from "@/components/events/EventsBrowse";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "evt-1",
    slug: "sample-meetup",
    title: "Sample Meetup",
    date: "2026-06-15",
    time: "18:00",
    location: "Boston, MA",
    type: "meetup",
    description: "A community meetup about AI tooling.",
    image: "/events/sample.png",
    lumaUrl: "https://lu.ma/sample",
    lumaEventId: "sample-id",
    registrationRequired: true,
    ...overrides,
  } as Event;
}

describe("EventsBrowse", () => {
  const listingToday = "2026-06-15";

  it("renders browse tabs", () => {
    render(<EventsBrowse events={[]} listingTodayYmd={listingToday} />);
    expect(screen.getByRole("tab", { name: "TODAY" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "FUTURE" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PAST" })).toBeInTheDocument();
  });

  it("shows today events in the default today tab", () => {
    const events = [makeEvent({ id: "today-1", title: "Happening Today", date: listingToday })];
    render(<EventsBrowse events={events} listingTodayYmd={listingToday} />);
    expect(screen.getByRole("heading", { name: "Happening Today" })).toBeInTheDocument();
  });

  it("shows empty state when no events today", () => {
    render(<EventsBrowse events={[]} listingTodayYmd={listingToday} />);
    expect(screen.getByText("No events scheduled for today.")).toBeInTheDocument();
  });

  it("shows future events when switching to FUTURE tab", async () => {
    const user = userEvent.setup();
    const events = [makeEvent({ id: "future-1", title: "Upcoming Workshop", date: "2026-07-01" })];
    render(<EventsBrowse events={events} listingTodayYmd={listingToday} />);

    await user.click(screen.getByRole("tab", { name: "FUTURE" }));

    expect(screen.getByRole("heading", { name: "Upcoming Workshop" })).toBeInTheDocument();
  });

  it("shows Luma subscribe link when no future events", async () => {
    const user = userEvent.setup();
    render(<EventsBrowse events={[]} listingTodayYmd={listingToday} />);

    await user.click(screen.getByRole("tab", { name: "FUTURE" }));

    expect(screen.getByText(/Subscribe on Luma to get notified/)).toBeInTheDocument();
  });

  it("shows past events with recap links", async () => {
    const user = userEvent.setup();
    const events = [
      makeEvent({
        id: "past-1",
        slug: "old-meetup",
        title: "Past Meetup",
        date: "2026-05-01",
        primaryCtaHref: "https://example.com/recap",
        primaryCtaLabel: "Watch recap",
      }),
    ];
    render(<EventsBrowse events={events} listingTodayYmd={listingToday} />);

    await user.click(screen.getByRole("tab", { name: "PAST" }));

    expect(screen.getByRole("heading", { name: "Past Meetup" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch recap" })).toHaveAttribute(
      "href",
      "https://example.com/recap",
    );
    expect(screen.getByRole("link", { name: "Event recap" })).toHaveAttribute(
      "href",
      "/events/old-meetup",
    );
  });

  it("shows PyData registration CTA for PyData featured events", () => {
    const events = [
      makeEvent({
        id: "pydata-1",
        slug: PYDATA_2026_EVENT_SLUG,
        title: "PyData Boston 2026",
        date: listingToday,
      }),
    ];
    render(<EventsBrowse events={events} listingTodayYmd={listingToday} />);

    expect(screen.getByRole("link", { name: /Register for badge/i })).toHaveAttribute(
      "href",
      `/events/${PYDATA_2026_EVENT_SLUG}/register`,
    );
    expect(screen.getByRole("button", { name: "Also RSVP on Luma" })).toBeInTheDocument();
  });

  it("shows Register on Luma for non-PyData future events", async () => {
    const user = userEvent.setup();
    const events = [
      makeEvent({
        id: "future-luma",
        title: "Future Luma Event",
        date: "2026-08-01",
        lumaUrl: "https://lu.ma/future-event",
      }),
    ];
    render(<EventsBrowse events={events} listingTodayYmd={listingToday} />);

    await user.click(screen.getByRole("tab", { name: "FUTURE" }));

    expect(
      screen.getByRole("link", { name: /Register for Future Luma Event/i }),
    ).toHaveAttribute("href", "https://lu.ma/future-event");
  });
});
