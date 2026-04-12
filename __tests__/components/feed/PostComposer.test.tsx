import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock("@/lib/firebase", () => ({ db: null }));

import { PostComposer } from "@/components/feed/PostComposer";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: "user-1",
    displayName: "Alice Smith",
    email: "alice@example.com",
    photoURL: null,
    ...overrides,
  } as User;
}

describe("PostComposer", () => {
  const baseProps = {
    value: "",
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    posting: false,
  };

  it("renders sign-in prompt when no user", () => {
    render(<PostComposer {...baseProps} user={null} />);
    expect(screen.getByText("Sign in to post messages")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toHaveAttribute("href", "/login?redirect=/members");
  });

  it("renders composer when user is logged in", () => {
    render(<PostComposer {...baseProps} user={makeUser()} />);
    expect(screen.getByLabelText("What's on your mind?")).toBeInTheDocument();
  });

  it("shows user initials when no photo", () => {
    render(<PostComposer {...baseProps} user={makeUser()} />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("shows user photo when provided", () => {
    const user = makeUser({ photoURL: "https://example.com/photo.jpg" });
    render(<PostComposer {...baseProps} user={user} />);
    expect(screen.getByAltText("Alice Smith")).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<PostComposer {...baseProps} user={makeUser()} onChange={onChange} />);

    await user.type(screen.getByLabelText("What's on your mind?"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("disables submit when value is too short", () => {
    render(<PostComposer {...baseProps} user={makeUser()} value="short" />);
    expect(screen.getByLabelText("Post")).toBeDisabled();
  });

  it("enables submit when value meets minimum length", () => {
    const longText = "a".repeat(100);
    render(<PostComposer {...baseProps} user={makeUser()} value={longText} />);
    expect(screen.getByLabelText("Post")).not.toBeDisabled();
  });

  it("disables submit while posting", () => {
    const longText = "a".repeat(100);
    render(<PostComposer {...baseProps} user={makeUser()} value={longText} posting={true} />);
    expect(screen.getByLabelText("Posting message")).toBeDisabled();
  });

  it("shows Posting... text while posting", () => {
    const longText = "a".repeat(100);
    render(<PostComposer {...baseProps} user={makeUser()} value={longText} posting={true} />);
    expect(screen.getByText("Posting...")).toBeInTheDocument();
  });

  it("calls onSubmit when button clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const longText = "a".repeat(100);
    render(<PostComposer {...baseProps} user={makeUser()} value={longText} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText("Post"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows character count", () => {
    render(<PostComposer {...baseProps} user={makeUser()} value="Hello" />);
    expect(screen.getByText("5/500 (minimum 100)")).toBeInTheDocument();
  });

  it("uses custom placeholder and submitLabel", () => {
    render(
      <PostComposer
        {...baseProps}
        user={makeUser()}
        placeholder="Custom placeholder"
        submitLabel="Send"
      />,
    );
    expect(screen.getByLabelText("Custom placeholder")).toBeInTheDocument();
    expect(screen.getByLabelText("Send")).toBeInTheDocument();
  });

  it("uses custom minLength and maxLength", () => {
    render(
      <PostComposer
        {...baseProps}
        user={makeUser()}
        value="Hello"
        minLength={10}
        maxLength={200}
      />,
    );
    expect(screen.getByText("5/200 (minimum 10)")).toBeInTheDocument();
  });
});
