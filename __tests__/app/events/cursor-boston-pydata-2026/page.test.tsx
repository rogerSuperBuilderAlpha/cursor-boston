/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import type { PyDataSubmission } from "@/lib/pydata-submissions";

jest.mock("@/lib/pydata-submissions", () => ({
  getPyDataSubmissions: jest.fn(() => []),
  PYDATA_SUBMISSIONS_BRANCH: "pydata-2026-submissions",
  PYDATA_SUBMISSIONS_DIR: "pydata-2026-submissions",
  PYDATA_SUBMISSIONS_REPO_URL:
    "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
}));

jest.mock("@/components/events/CursorSubmitPromptButton", () => ({
  CursorSubmitPromptButton: () => <button type="button">Copy submit prompt</button>,
}));

const { getPyDataSubmissions } = jest.requireMock<{
  getPyDataSubmissions: jest.Mock;
}>("@/lib/pydata-submissions");

const sampleSubmission: PyDataSubmission = {
  githubHandle: "demo-user",
  displayName: "Demo User",
  title: "Insight notebook",
  description: "One compelling insight from the dataset.",
  tags: ["pandas"],
  collaborators: [],
  notebookUrl: "https://github.com/example/notebook",
  folderUrl: "https://github.com/example/folder",
  score: {
    score: 8.5,
    rationale: "Strong narrative.",
    model: "claude-test",
    scoredAt: "2026-05-14T00:00:00.000Z",
  },
  submittedAt: "2026-05-13T22:00:00.000Z",
  winnerEligible: true,
};

describe("PyData 2026 event page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPyDataSubmissions.mockReturnValue([]);
  });

  it("renders hub sections when there are no submissions", async () => {
    const Page = (await import("@/app/events/cursor-boston-pydata-2026/page"))
      .default;
    render(<Page />);
    expect(screen.getByText("Public showcase")).toBeInTheDocument();
    expect(screen.getByText("The challenge")).toBeInTheDocument();
    expect(screen.getByText("No merged submissions yet")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "pydata-2026-submissions" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /Copy submit prompt/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders eligible submission cards from build-time data", async () => {
    getPyDataSubmissions.mockReturnValue([sampleSubmission]);
    const Page = (await import("@/app/events/cursor-boston-pydata-2026/page"))
      .default;
    render(<Page />);
    expect(screen.getByText("Insight notebook")).toBeInTheDocument();
    expect(screen.getByText(/demo-user/i)).toBeInTheDocument();
    expect(screen.getAllByText("Winner eligible").length).toBeGreaterThan(0);
    expect(screen.getByText(/Merged submissions/i)).toBeInTheDocument();
  });
});
