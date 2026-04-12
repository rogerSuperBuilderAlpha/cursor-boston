 

import { render, screen } from "@testing-library/react";
import { TalksTab } from "@/app/(auth)/profile/_components/TalksTab";
import type { TalkSubmission } from "@/app/(auth)/profile/_types";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

const makeTalk = (
  id: string,
  title: string,
  status: string,
  date?: Date
): TalkSubmission => ({
  id,
  title,
  status,
  submittedAt: date ? { toDate: () => date } : null,
});

describe("TalksTab", () => {
  it("renders section title and Submit a Talk link", () => {
    render(<TalksTab talkSubmissions={[]} loadingData={false} />);
    expect(screen.getByText("My Talk Submissions")).toBeInTheDocument();
    expect(screen.getAllByText("Submit a Talk").length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading spinner when loading", () => {
    render(<TalksTab talkSubmissions={[]} loadingData={true} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no talks submitted", () => {
    render(<TalksTab talkSubmissions={[]} loadingData={false} />);
    expect(screen.getByText(/haven.*submitted any talks yet/)).toBeInTheDocument();
  });

  it("renders talk submissions with details", () => {
    const talks = [makeTalk("1", "Building AI Apps", "approved", new Date("2026-03-15"))];
    render(<TalksTab talkSubmissions={talks} loadingData={false} />);
    expect(screen.getByText("Building AI Apps")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("shows 'Recently submitted' when no submittedAt", () => {
    const talks = [makeTalk("1", "No Date Talk", "pending")];
    render(<TalksTab talkSubmissions={talks} loadingData={false} />);
    expect(screen.getByText("Recently submitted")).toBeInTheDocument();
  });

  it("displays correct status colors", () => {
    const talks = [
      makeTalk("1", "Talk A", "approved"),
      makeTalk("2", "Talk B", "rejected"),
      makeTalk("3", "Talk C", "completed"),
      makeTalk("4", "Talk D", "pending"),
    ];
    render(<TalksTab talkSubmissions={talks} loadingData={false} />);
    expect(screen.getByText("approved").className).toContain("text-emerald-400");
    expect(screen.getByText("rejected").className).toContain("text-red-400");
    expect(screen.getByText("completed").className).toContain("text-purple-400");
    expect(screen.getByText("pending").className).toContain("text-yellow-400");
  });

  it("renders multiple submissions", () => {
    const talks = [
      makeTalk("1", "Talk One", "approved"),
      makeTalk("2", "Talk Two", "pending"),
      makeTalk("3", "Talk Three", "rejected"),
    ];
    render(<TalksTab talkSubmissions={talks} loadingData={false} />);
    expect(screen.getByText("Talk One")).toBeInTheDocument();
    expect(screen.getByText("Talk Two")).toBeInTheDocument();
    expect(screen.getByText("Talk Three")).toBeInTheDocument();
  });
});
