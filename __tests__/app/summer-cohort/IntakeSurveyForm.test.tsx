/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeSurveyForm } from "@/app/summer-cohort/_components/IntakeSurveyForm";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

function yesNoField(labelPattern: RegExp) {
  const label = screen.getByText(labelPattern);
  const field = label.parentElement;
  if (!field) throw new Error(`yes/no field not found for ${labelPattern}`);
  return within(field);
}

async function fillRequiredIntakeFields(user: ReturnType<typeof userEvent.setup>) {
  const emailInput = screen.getByDisplayValue("test@example.com");
  await user.clear(emailInput);
  await user.type(emailInput, "filled@example.com");

  const demographics = screen
    .getByText("2. Demographics")
    .closest("fieldset") as HTMLElement;
  const programming = screen
    .getByText("3. Programming background")
    .closest("fieldset") as HTMLElement;
  const aiExposure = screen
    .getByText("4. AI tool exposure")
    .closest("fieldset") as HTMLElement;
  const platformExposure = screen
    .getByText("5. Algorithmic platform exposure")
    .closest("fieldset") as HTMLElement;
  const programIntent = screen
    .getByText("7. Program intent")
    .closest("fieldset") as HTMLElement;

  await user.type(within(demographics).getByRole("spinbutton"), "28");
  await user.selectOptions(within(demographics).getAllByRole("combobox")[0], "woman");
  const demoTextboxes = within(demographics).getAllByRole("textbox");
  await user.type(demoTextboxes[0], "USA");
  await user.type(demoTextboxes[1], "USA");
  await user.type(demoTextboxes[2], "English");
  await user.selectOptions(within(demographics).getAllByRole("combobox")[1], "native");
  await user.selectOptions(within(demographics).getAllByRole("combobox")[2], "bachelors");
  await user.type(demoTextboxes[3], "CS");
  await user.selectOptions(within(demographics).getAllByRole("combobox")[3], "yes");

  await user.selectOptions(within(programming).getAllByRole("combobox")[0], "3-5");
  await user.click(
    yesNoField(/Prior employment as a software engineer/i).getByRole("radio", {
      name: "No",
    }),
  );
  await user.selectOptions(within(programming).getAllByRole("combobox")[1], "undergraduate");

  await user.type(within(aiExposure).getAllByRole("spinbutton")[0], "2023");
  await user.selectOptions(within(aiExposure).getAllByRole("combobox")[0], "daily");
  await user.selectOptions(within(aiExposure).getAllByRole("combobox")[1], "daily");
  await user.click(
    yesNoField(/Have you shipped a working product built with substantial AI assistance/i).getByRole("radio", { name: "No" }),
  );
  await user.type(within(aiExposure).getAllByRole("spinbutton")[1], "12");

  await user.type(within(platformExposure).getByRole("spinbutton"), "5");
  await user.click(
    yesNoField(/Posted content as a creator on any algorithmic platform/i).getByRole("radio", { name: "No" }),
  );
  await user.click(
    yesNoField(/Worked on a gig labor platform/i).getByRole("radio", { name: "No" }),
  );

  for (const radio of screen.getAllByRole("radio", { name: "5" })) {
    await user.click(radio);
  }

  const textareas = within(programIntent).getAllByRole("textbox");
  await user.type(textareas[0], "Ship faster with peers.");
  await user.type(textareas[1], "Launch a side project.");
}

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
    expect(screen.getByDisplayValue("cohort-2")).toBeInTheDocument();
    expect(screen.getByText(/Why did you join the program/i)).toBeInTheDocument();
    expect(screen.getByText(/Cohort 2 only/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Draft restored from this browser/i)).toBeInTheDocument();
  });

  it("shows server validation errors for missing fields", async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        missingFields: ["age", "whyJoined"],
      }),
    }) as typeof fetch;

    render(
      <IntakeSurveyForm
        defaultEmail="test@example.com"
        cohortId="cohort-1"
        participatedInCohort1={false}
        onComplete={onComplete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Submit & unlock dashboard/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Missing or invalid: age, whyJoined/i)).toBeInTheDocument();
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/summer-cohort/intake-survey",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submits filled form and calls onComplete", async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();

    render(
      <IntakeSurveyForm
        defaultEmail="test@example.com"
        cohortId="cohort-1"
        participatedInCohort1={false}
        onComplete={onComplete}
      />,
    );

    await fillRequiredIntakeFields(user);
    await user.click(
      screen.getByRole("button", { name: /Submit & unlock dashboard/i }),
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/summer-cohort/intake-survey",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
    expect(localStorage.getItem("summer-cohort-intake-draft:v2:uid-1")).toBeNull();
  });

  it("shows error when user is not signed in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const user = userEvent.setup();

    render(
      <IntakeSurveyForm
        defaultEmail="test@example.com"
        cohortId="cohort-1"
        participatedInCohort1={false}
        onComplete={jest.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Submit & unlock dashboard/i }),
    );

    expect(await screen.findByText(/You must be signed in to submit/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reveals gender self-describe when prefer-self-describe is selected", async () => {
    const user = userEvent.setup();
    render(
      <IntakeSurveyForm
        defaultEmail="test@example.com"
        cohortId="cohort-1"
        participatedInCohort1={false}
        onComplete={jest.fn()}
      />,
    );

    const demographics = screen
      .getByText("2. Demographics")
      .closest("fieldset") as HTMLElement;
    expect(within(demographics).getAllByRole("textbox")).toHaveLength(4);

    await user.selectOptions(
      within(demographics).getAllByRole("combobox")[0],
      "prefer-self-describe",
    );

    expect(within(demographics).getAllByRole("textbox")).toHaveLength(5);
  });
});
