 

import { render, screen } from "@testing-library/react";
import { ActivitySection } from "@/app/(auth)/profile/_components/ActivitySection";
import type { ProfileContextValue } from "@/app/(auth)/profile/_contexts/ProfileContext";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

let mockContextValue: Partial<ProfileContextValue>;

jest.mock("@/app/(auth)/profile/_contexts/ProfileContext", () => ({
  useProfileContext: () => mockContextValue,
}));

const makeRegistration = (id: string, title: string, status: string, date?: string) => ({
  id,
  eventId: `event-${id}`,
  eventTitle: title,
  eventDate: date,
  userId: "u1",
  userEmail: "u@e.com",
  registeredAt: { toDate: () => new Date("2026-01-01") },
  source: "manual" as const,
  status: status as "registered" | "attended" | "cancelled",
});

const makeTalk = (id: string, title: string, status: string) => ({
  id,
  title,
  status,
  submittedAt: { toDate: () => new Date("2026-02-01") },
});

describe("ActivitySection", () => {
  beforeEach(() => {
    mockContextValue = {
      data: {
        registrations: [],
        talkSubmissions: [],
        loadingData: false,
      } as unknown as ProfileContextValue["data"],
    };
  });

  it("shows loading spinner when data is loading", () => {
    mockContextValue = {
      data: { registrations: [], talkSubmissions: [], loadingData: true } as unknown as ProfileContextValue["data"],
    };
    render(<ActivitySection />);
    expect(screen.getByText("Activity")).toBeInTheDocument();
    // Spinner has animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state with links when no activity", () => {
    render(<ActivitySection />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText("Browse Events")).toBeInTheDocument();
    expect(screen.getByText("Submit a Talk")).toBeInTheDocument();
  });

  it("renders event registrations", () => {
    mockContextValue = {
      data: {
        registrations: [makeRegistration("1", "React Meetup", "attended", "2026-03-15")],
        talkSubmissions: [],
        loadingData: false,
      } as unknown as ProfileContextValue["data"],
    };
    render(<ActivitySection />);
    expect(screen.getByText("React Meetup")).toBeInTheDocument();
    expect(screen.getByText("2026-03-15")).toBeInTheDocument();
    expect(screen.getByText("attended")).toBeInTheDocument();
  });

  it("renders talk submissions", () => {
    mockContextValue = {
      data: {
        registrations: [],
        talkSubmissions: [makeTalk("t1", "My Talk", "approved")],
        loadingData: false,
      } as unknown as ProfileContextValue["data"],
    };
    render(<ActivitySection />);
    expect(screen.getByText("My Talk")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("shows overflow message when more than 5 events", () => {
    const regs = Array.from({ length: 7 }, (_, i) =>
      makeRegistration(`r${i}`, `Event ${i}`, "registered")
    );
    mockContextValue = {
      data: {
        registrations: regs,
        talkSubmissions: [],
        loadingData: false,
      } as unknown as ProfileContextValue["data"],
    };
    render(<ActivitySection />);
    expect(screen.getByText("+2 more events")).toBeInTheDocument();
  });

  it("applies correct status colors", () => {
    mockContextValue = {
      data: {
        registrations: [
          makeRegistration("1", "Attended Event", "attended"),
          makeRegistration("2", "Cancelled Event", "cancelled"),
          makeRegistration("3", "Registered Event", "registered"),
        ],
        talkSubmissions: [],
        loadingData: false,
      } as unknown as ProfileContextValue["data"],
    };
    render(<ActivitySection />);
    const attended = screen.getByText("attended");
    expect(attended.className).toContain("text-emerald-400");
    const cancelled = screen.getByText("cancelled");
    expect(cancelled.className).toContain("text-red-400");
    const registered = screen.getByText("registered");
    expect(registered.className).toContain("text-blue-400");
  });
});
