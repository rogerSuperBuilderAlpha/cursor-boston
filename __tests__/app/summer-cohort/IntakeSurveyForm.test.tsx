/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeSurveyForm } from "@/app/summer-cohort/_components/IntakeSurveyForm";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

describe("IntakeSurveyForm", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("uid-1"),
      loading: false,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as typeof fetch;
  });

  it("renders cohort intake fields", () => {
    render(
      <IntakeSurveyForm
        defaultEmail="test@example.com"
        cohortId="cohort-2"
        participatedInCohort1={false}
        onComplete={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Why did you join the program/i)).toBeInTheDocument();
  });

  it("hydrates draft from localStorage", () => {
    localStorage.setItem(
      "summer-cohort-intake-draft:v2:uid-1",
      JSON.stringify({ whyJoined: "Draft reason" }),
    );
    render(
      <IntakeSurveyForm
        defaultEmail="test@example.com"
        cohortId="cohort-1"
        participatedInCohort1={false}
        onComplete={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Draft reason")).toBeInTheDocument();
  });
});
