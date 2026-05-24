/**
 * @jest-environment jsdom
 *
 * Coverage push: components/research/ResearchCard.tsx was at 7.7% on
 * 2026-05-23 (52 source lines). Every entry-type and edge-case branch
 * gets hit exactly once below.
 */
import { render, screen, within } from "@testing-library/react";
import { ResearchCard } from "@/components/research/ResearchCard";
import type { ActiveResearchEntry, WorkingPaperEntry, DatasetEntry, CollaborationEntry, CfpEntry } from "@/lib/research";

// Stable now() so date-based branches (expired / closed) deterministic.
const NOW = new Date("2026-05-23T12:00:00Z");
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

const baseFields = {
  slug: "test-entry",
  authors: [
    { name: "Ada Lovelace", affiliation: "Analytical Engine Co" },
    { name: "Charles Babbage" },
  ],
  postedAt: "2026-05-01T00:00:00Z",
  disciplines: ["computer-science", "history"],
  summary: "A reasonably long summary that exceeds the 20-character minimum.",
  sourceRepoUrl: "https://example.com/repo",
};

function makeActive(overrides: Partial<ActiveResearchEntry> = {}): ActiveResearchEntry {
  return {
    ...baseFields,
    type: "active-research",
    title: "Recruiting study participants",
    deadline: "2026-06-01T00:00:00Z",
    compensation: "$50",
    timeCommitment: "1 hour",
    location: "remote",
    eligibility: "18+",
    status: "open",
    ...overrides,
  } as ActiveResearchEntry;
}

function makeWorkingPaper(overrides: Partial<WorkingPaperEntry> = {}): WorkingPaperEntry {
  return {
    ...baseFields,
    type: "working-paper",
    title: "Draft paper on test coverage",
    version: "v0.1",
    license: "CC-BY-4.0",
    pdfUrl: "https://example.com/paper.pdf",
    peerReviewStatus: "approved-with-reservations",
    ...overrides,
  } as WorkingPaperEntry;
}

function makeDataset(overrides: Partial<DatasetEntry> = {}): DatasetEntry {
  return {
    ...baseFields,
    type: "dataset",
    title: "Open commit corpus",
    license: "ODbL",
    size: "1.2 GB",
    format: ["jsonl", "parquet"],
    ...overrides,
  } as DatasetEntry;
}

function makeCollaboration(overrides: Partial<CollaborationEntry> = {}): CollaborationEntry {
  return {
    ...baseFields,
    type: "collaboration",
    title: "Looking for a co-author",
    collaborationType: "co-author",
    projectStage: "writing",
    seeking: "Anyone with stats experience",
    timeCommitment: "4 hours/week",
    status: "open",
    ...overrides,
  } as CollaborationEntry;
}

function makeCfp(overrides: Partial<CfpEntry> = {}): CfpEntry {
  return {
    ...baseFields,
    type: "cfp",
    title: "Call for papers: AI in Practice",
    conferenceDates: "Oct 1-3, 2026",
    location: "Boston, USA",
    submissionDeadline: "2026-06-15T00:00:00Z",
    conferenceUrl: "https://example.com/conf",
    organizingBody: "ACM",
    submissionTypes: ["full paper", "poster"],
    status: "open",
    ...overrides,
  } as CfpEntry;
}

describe("ResearchCard", () => {
  describe("active-research", () => {
    it("renders title, authors, deadline + slot count", () => {
      render(
        <ResearchCard
          entry={makeActive({ slotsRemaining: 3 })}
        />
      );
      expect(
        screen.getByRole("heading", { name: "Recruiting study participants" })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Ada Lovelace \(Analytical Engine Co\) · Charles Babbage/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Deadline /)).toBeInTheDocument();
      expect(screen.getByText(/3 slots left/)).toBeInTheDocument();
    });

    it("shows 'Closed' for past deadline", () => {
      render(
        <ResearchCard
          entry={makeActive({ deadline: "2026-05-01T00:00:00Z" })}
        />
      );
      expect(screen.getByText(/Closed /)).toBeInTheDocument();
    });
  });

  describe("working-paper", () => {
    it("renders version + license + PDF link", () => {
      render(<ResearchCard entry={makeWorkingPaper()} />);
      expect(screen.getByText(/v0.1 · CC-BY-4.0/)).toBeInTheDocument();
      const pdf = screen.getByRole("link", { name: /PDF/ });
      expect(pdf).toHaveAttribute("href", "https://example.com/paper.pdf");
      // approved-with-reservations gets humanized
      expect(screen.getByText(/approved with reservations/i)).toBeInTheDocument();
    });
  });

  describe("dataset", () => {
    it("renders license, size, and format chips", () => {
      render(<ResearchCard entry={makeDataset()} />);
      expect(screen.getByText("ODbL")).toBeInTheDocument();
      expect(screen.getByText("1.2 GB")).toBeInTheDocument();
      expect(screen.getByText("jsonl")).toBeInTheDocument();
      expect(screen.getByText("parquet")).toBeInTheDocument();
    });

    it("renders without optional fields", () => {
      render(<ResearchCard entry={makeDataset({ size: undefined, format: undefined })} />);
      // License still shows even with everything else missing
      expect(screen.getByText("ODbL")).toBeInTheDocument();
      expect(screen.queryByText("1.2 GB")).not.toBeInTheDocument();
    });
  });

  describe("collaboration", () => {
    it("renders type, stage, time commitment, and deadline", () => {
      render(
        <ResearchCard
          entry={makeCollaboration({ deadline: "2026-06-01T00:00:00Z" })}
        />
      );
      expect(screen.getByText(/co author/i)).toBeInTheDocument();
      expect(screen.getByText(/stage: writing/)).toBeInTheDocument();
      expect(screen.getByText("4 hours/week")).toBeInTheDocument();
      expect(screen.getByText(/Need by /)).toBeInTheDocument();
    });

    it("omits the Need-by row when no deadline", () => {
      render(<ResearchCard entry={makeCollaboration()} />);
      expect(screen.queryByText(/Need by /)).not.toBeInTheDocument();
    });
  });

  describe("cfp", () => {
    it("renders submission deadline, conference dates, and external link", () => {
      render(<ResearchCard entry={makeCfp()} />);
      expect(screen.getByText(/Submit by /)).toBeInTheDocument();
      expect(screen.getByText("Oct 1-3, 2026")).toBeInTheDocument();
      const conf = screen.getByRole("link", { name: /Conference site/ });
      expect(conf).toHaveAttribute("href", "https://example.com/conf");
    });

    it("shows 'Submission closed' once submissionDeadline passes", () => {
      render(
        <ResearchCard
          entry={makeCfp({ submissionDeadline: "2026-05-01T00:00:00Z" })}
        />
      );
      expect(screen.getByText(/Submission closed/)).toBeInTheDocument();
    });
  });

  describe("sample entries", () => {
    it("renders the Sample banner and disables external CTAs", () => {
      const entry = makeCfp({ isSample: true });
      render(<ResearchCard entry={entry} />);
      expect(screen.getByText(/Sample · placeholder entry/)).toBeInTheDocument();
      // Conference site link replaced with disabled span
      expect(
        screen.queryByRole("link", { name: /Conference site/ })
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Conference site \(sample\)/)).toBeInTheDocument();
      // Source repo link also replaced with disabled span
      expect(
        screen.queryByRole("link", { name: /Source repo/ })
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Source repo \(sample\)/)).toBeInTheDocument();
    });

    it("greys out the working-paper PDF link on sample entries", () => {
      render(<ResearchCard entry={makeWorkingPaper({ isSample: true })} />);
      expect(screen.queryByRole("link", { name: /PDF/ })).not.toBeInTheDocument();
      expect(screen.getByText(/PDF/)).toBeInTheDocument();
    });
  });

  describe("metadata header", () => {
    it("shows 'updated' suffix when updatedAt is set", () => {
      render(
        <ResearchCard
          entry={makeActive({ updatedAt: "2026-05-10T00:00:00Z" })}
        />
      );
      expect(screen.getByText(/· updated/)).toBeInTheDocument();
    });

    it("only shows postedAt when no updatedAt", () => {
      render(<ResearchCard entry={makeActive()} />);
      expect(screen.queryByText(/· updated/)).not.toBeInTheDocument();
    });
  });

  describe("discipline chips", () => {
    it("caps visible discipline chips at four", () => {
      const entry = makeActive({
        disciplines: ["a", "b", "c", "d", "e", "f"],
      });
      const { container } = render(<ResearchCard entry={entry} />);
      // The chips share a class; just count their rendered text.
      for (const d of ["a", "b", "c", "d"]) {
        expect(within(container).getByText(d)).toBeInTheDocument();
      }
      expect(within(container).queryByText("e")).not.toBeInTheDocument();
      expect(within(container).queryByText("f")).not.toBeInTheDocument();
    });
  });
});
