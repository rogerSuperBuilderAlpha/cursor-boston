/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import { RunDetail } from "@/app/pr-ideas/_components/RunDetail";
import type { CursorIdeaRun } from "@/app/pr-ideas/_lib/types";

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const baseRun: CursorIdeaRun = {
  id: "run-q",
  status: "running",
  workflowStage: "questions",
  prompt: "Build feature X",
  inputs: { mode: "idea" },
  questions: [
    { id: "q1", question: "Which framework?", suggestions: ["Next.js", "Remix"] },
  ],
};

describe("RunDetail workflow stages", () => {
  it("renders questions stage with suggestion options", () => {
    render(
      <RunDetail
        run={baseRun}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={jest.fn().mockResolvedValue(null)}
      />,
    );
    expect(screen.getByText(/Build feature X/i)).toBeInTheDocument();
    expect(screen.getByText(/Which framework/i)).toBeInTheDocument();
  });

});
