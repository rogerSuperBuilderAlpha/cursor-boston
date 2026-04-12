 

import { render, screen } from "@testing-library/react";
import { EventsTab } from "@/app/(auth)/profile/_components/EventsTab";
import type { EventRegistration } from "@/lib/registrations";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

const makeRegistration = (
  id: string,
  title: string,
  status: "registered" | "attended" | "cancelled",
  date?: string
): EventRegistration => ({
  id,
  eventId: `event-${id}`,
  eventTitle: title,
  eventDate: date,
  userId: "u1",
  userEmail: "u@e.com",
  registeredAt: { toDate: () => new Date("2026-01-01") } as unknown as EventRegistration["registeredAt"],
  source: "manual",
  status,
});

describe("EventsTab", () => {
  it("renders section title and Browse Events link", () => {
    render(<EventsTab registrations={[]} loadingData={false} />);
    expect(screen.getByText("My Event Registrations")).toBeInTheDocument();
    expect(screen.getAllByText("Browse Events").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading spinner when loading", () => {
    render(<EventsTab registrations={[]} loadingData={true} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no registrations", () => {
    render(<EventsTab registrations={[]} loadingData={false} />);
    expect(screen.getByText(/haven.*registered for any events yet/)).toBeInTheDocument();
  });

  it("renders event registrations with details", () => {
    const regs = [makeRegistration("1", "AI Workshop", "attended", "2026-04-10")];
    render(<EventsTab registrations={regs} loadingData={false} />);
    expect(screen.getByText("AI Workshop")).toBeInTheDocument();
    expect(screen.getByText("2026-04-10")).toBeInTheDocument();
    expect(screen.getByText("Attended")).toBeInTheDocument();
  });

  it("shows Date TBD when no event date", () => {
    const regs = [makeRegistration("1", "Mystery Event", "registered")];
    render(<EventsTab registrations={regs} loadingData={false} />);
    expect(screen.getByText("Date TBD")).toBeInTheDocument();
  });

  it("displays correct status labels", () => {
    const regs = [
      makeRegistration("1", "Event A", "attended"),
      makeRegistration("2", "Event B", "cancelled"),
      makeRegistration("3", "Event C", "registered"),
    ];
    render(<EventsTab registrations={regs} loadingData={false} />);
    expect(screen.getByText("Attended")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Registered")).toBeInTheDocument();
  });

  it("applies correct color classes per status", () => {
    const regs = [
      makeRegistration("1", "Event A", "attended"),
      makeRegistration("2", "Event B", "cancelled"),
      makeRegistration("3", "Event C", "registered"),
    ];
    render(<EventsTab registrations={regs} loadingData={false} />);
    expect(screen.getByText("Attended").className).toContain("text-emerald-400");
    expect(screen.getByText("Cancelled").className).toContain("text-red-400");
    expect(screen.getByText("Registered").className).toContain("text-blue-400");
  });
});
