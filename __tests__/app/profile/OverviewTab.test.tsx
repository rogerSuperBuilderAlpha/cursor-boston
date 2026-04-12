/* eslint-disable @next/next/no-img-element */

import { render, screen } from "@testing-library/react";
import { OverviewTab } from "@/app/(auth)/profile/_components/OverviewTab";
import type { EventRegistration } from "@/lib/registrations";
import type { TalkSubmission, ConnectedAgent } from "@/app/(auth)/profile/_types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img alt="" data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

const makeRegistration = (id: string, title: string): EventRegistration => ({
  id,
  eventId: `event-${id}`,
  eventTitle: title,
  eventDate: "2026-04-10",
  userId: "u1",
  userEmail: "u@e.com",
  registeredAt: { toDate: () => new Date("2026-01-01") } as unknown as EventRegistration["registeredAt"],
  source: "manual",
  status: "registered",
});

const makeTalk = (id: string, title: string): TalkSubmission => ({
  id,
  title,
  status: "pending",
  submittedAt: { toDate: () => new Date("2026-02-01") },
});

const makeAgent = (id: string, name: string, opts?: Partial<ConnectedAgent>): ConnectedAgent => ({
  id,
  name,
  ...opts,
});

const defaultProps = {
  registrations: [] as EventRegistration[],
  talkSubmissions: [] as TalkSubmission[],
  connectedAgents: [] as ConnectedAgent[],
  loadingData: false,
  loadingAgents: false,
};

describe("OverviewTab", () => {
  it("renders quick action links", () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText("Browse Events")).toBeInTheDocument();
    expect(screen.getByText("Submit a Talk")).toBeInTheDocument();
    expect(screen.getByText("Join Discord")).toBeInTheDocument();
    expect(screen.getByText("Request an Event")).toBeInTheDocument();
  });

  it("shows empty activity state when no data", () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText(/Browse upcoming events/)).toBeInTheDocument();
  });

  it("shows loading spinner for recent activity", () => {
    render(<OverviewTab {...defaultProps} loadingData={true} />);
    const spinners = document.querySelectorAll(".animate-spin");
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  it("renders recent registrations", () => {
    const regs = [makeRegistration("1", "AI Workshop")];
    render(<OverviewTab {...defaultProps} registrations={regs} />);
    expect(screen.getByText("Registered for AI Workshop")).toBeInTheDocument();
  });

  it("renders recent talk submissions", () => {
    const talks = [makeTalk("t1", "My Talk")];
    render(<OverviewTab {...defaultProps} talkSubmissions={talks} />);
    expect(screen.getByText("Submitted talk: My Talk")).toBeInTheDocument();
    expect(screen.getByText("Status: pending")).toBeInTheDocument();
  });

  it("does not render AI Agents section when no agents", () => {
    render(<OverviewTab {...defaultProps} />);
    expect(screen.queryByText("Your AI Agents")).not.toBeInTheDocument();
  });

  it("renders AI Agents section with connected agents", () => {
    const agents = [makeAgent("a1", "CodeBot", { description: "Helps with code" })];
    render(<OverviewTab {...defaultProps} connectedAgents={agents} />);
    expect(screen.getByText("Your AI Agents")).toBeInTheDocument();
    expect(screen.getByText("CodeBot")).toBeInTheDocument();
    expect(screen.getByText("Helps with code")).toBeInTheDocument();
    expect(screen.getByText("1 connected")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders agent avatar when avatarUrl is provided", () => {
    const agents = [makeAgent("a1", "AvatarBot", { avatarUrl: "https://img.com/bot.png" })];
    render(<OverviewTab {...defaultProps} connectedAgents={agents} />);
    const img = screen.getByAltText("AvatarBot");
    expect(img).toHaveAttribute("src", "https://img.com/bot.png");
  });

  it("shows loading spinner for agents section", () => {
    render(<OverviewTab {...defaultProps} connectedAgents={[makeAgent("a1", "Bot")]} loadingAgents={true} />);
    expect(screen.getByText("Your AI Agents")).toBeInTheDocument();
    const spinners = document.querySelectorAll(".animate-spin");
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  it("limits recent activity to 3 items each", () => {
    const regs = Array.from({ length: 5 }, (_, i) => makeRegistration(`r${i}`, `Event ${i}`));
    const talks = Array.from({ length: 5 }, (_, i) => makeTalk(`t${i}`, `Talk ${i}`));
    render(<OverviewTab {...defaultProps} registrations={regs} talkSubmissions={talks} />);
    // Only 3 of each should render
    const regItems = screen.getAllByText(/^Registered for Event/);
    expect(regItems).toHaveLength(3);
    const talkItems = screen.getAllByText(/^Submitted talk: Talk/);
    expect(talkItems).toHaveLength(3);
  });
});
