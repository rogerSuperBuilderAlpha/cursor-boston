/* eslint-disable @next/next/no-img-element */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProfileModal } from "@/app/(auth)/profile/_components/EditProfileModal";
import type { User } from "firebase/auth";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img alt="" data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: ({ name }: { name?: string | null }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

jest.mock("@/components/ui/FormField", () => ({
  FormInput: (props: Record<string, unknown>) => (
    <input
      id={props.id as string}
      value={props.value as string}
      onChange={props.onChange as React.ChangeEventHandler<HTMLInputElement>}
      placeholder={props.placeholder as string}
      aria-label={props.label as string}
    />
  ),
}));

const mockUser = {
  displayName: "Test User",
  photoURL: "https://example.com/photo.jpg",
  email: "test@example.com",
} as unknown as User;

describe("EditProfileModal", () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the modal with title and buttons", () => {
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    expect(screen.getByText("Edit Profile")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
    expect(screen.getByText("Choose Photo")).toBeInTheDocument();
  });

  it("pre-fills the name input with user displayName", () => {
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    const input = screen.getByDisplayValue("Test User");
    expect(input).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button (aria-label Close) is clicked", async () => {
    const user = userEvent.setup();
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSave with trimmed name when Save is clicked", async () => {
    const user = userEvent.setup();
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByText("Save Changes"));
    expect(onSave).toHaveBeenCalledWith("Test User", undefined);
  });

  it("shows saving state while save is in progress", async () => {
    let resolveSave: () => void;
    const slowSave = jest.fn(
      () => new Promise<void>((r) => { resolveSave = r; })
    );
    const user = userEvent.setup();
    render(<EditProfileModal user={mockUser} onSave={slowSave} onClose={onClose} />);
    await user.click(screen.getByText("Save Changes"));
    expect(screen.getByText("Saving...")).toBeInTheDocument();
    resolveSave!();
  });

  it("shows error message when save fails", async () => {
    const failSave = jest.fn().mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(<EditProfileModal user={mockUser} onSave={failSave} onClose={onClose} />);
    await user.click(screen.getByText("Save Changes"));
    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("has role=dialog and aria-modal", () => {
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders avatar when no photo is selected", () => {
    render(<EditProfileModal user={mockUser} onSave={onSave} onClose={onClose} />);
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
  });
});
