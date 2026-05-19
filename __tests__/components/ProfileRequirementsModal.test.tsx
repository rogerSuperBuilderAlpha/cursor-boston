/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import ProfileRequirementsModal from "@/components/ProfileRequirementsModal";

describe("ProfileRequirementsModal", () => {
  it("renders requirement rows when open", () => {
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasGithub", "hasDisplayName"]}
        title="Complete your profile"
      />,
    );
    expect(screen.getByText(/Complete your profile/i)).toBeInTheDocument();
  });
});
