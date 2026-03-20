import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as AuthContext from "@/contexts/AuthContext";
import CookbookPage from "@/app/cookbook/page";
import type { CookbookEntry } from "@/types/cookbook";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

jest.mock("remark-gfm", () => ({}));

jest.mock("rehype-sanitize", () => ({
  __esModule: true,
  default: () => () => {},
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

const mockUser = {
  uid: "test-uid",
  email: "test@example.com",
  displayName: "Test User",
  name: "Test User",
} as const;

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: React.ReactNode }) => (
    <pre data-testid="syntax-highlighter">{children}</pre>
  ),
}));

jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
  oneLight: {},
}));

const mockEntriesResponse = (entries: CookbookEntry[]) => ({
  entries,
  nextCursor: null,
  hasMore: false,
});

const mockVotesResponse = () => ({ userVotes: {} });

describe("CookbookPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: null });
    global.fetch = jest.fn((url: string | URL) => {
      const path = typeof url === "string" ? url : url.toString();
      if (path.includes("/api/cookbook/entries")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEntriesResponse([])),
        } as Response);
      }
      if (path.includes("/api/cookbook/vote")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVotesResponse()),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    }) as jest.Mock;
  });

  it("renders the hero section", async () => {
    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByText("Prompts & Rules")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Share and discover Cursor prompts, rules files/i)
    ).toBeInTheDocument();
  });

  it("renders the filter sidebar", async () => {
    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Search")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Works with")).toBeInTheDocument();
  });

  it("shows empty state when no entries", async () => {
    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByText(/No prompts yet/i)).toBeInTheDocument();
    });
  });

  it("renders entries when fetch returns data", async () => {
    const entries: CookbookEntry[] = [
      {
        id: "entry-1",
        title: "Rules for Go backend",
        description: "Production Go guidelines",
        promptContent: "You are working in a production Go codebase.",
        category: "code-generation",
        tags: ["go", "backend"],
        worksWith: ["Go"],
        authorId: "auth-1",
        authorDisplayName: "Alice",
        createdAt: "2026-02-28T00:00:00.000Z",
        upCount: 2,
        downCount: 0,
      },
    ];
    (global.fetch as jest.Mock).mockImplementation((url: string | URL) => {
      const path = typeof url === "string" ? url : url.toString();
      if (path.includes("/api/cookbook/entries")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEntriesResponse(entries)),
        } as Response);
      }
      if (path.includes("/api/cookbook/vote")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVotesResponse()),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByText("Rules for Go backend")).toBeInTheDocument();
    });
    expect(screen.getByText("Production Go guidelines")).toBeInTheDocument();
    expect(screen.getAllByText("Code Generation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/by Alice/)).toBeInTheDocument();
  });

  it("renders Add a Prompt CTA", async () => {
    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByText("Add a Prompt or Rule")).toBeInTheDocument();
    });
  });

  it("toggles submit form when Add CTA is clicked", async () => {
    (AuthContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    const user = userEvent.setup();
    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByText("Add a Prompt or Rule")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/Title \*/i)).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Add a Prompt or Rule/i }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Title \*/i)).toBeInTheDocument();
    });
  });

  it("shows sort dropdown", async () => {
    render(<CookbookPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Sort by")).toBeInTheDocument();
    });
  });

  it("fetches entries on mount", async () => {
    render(<CookbookPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/cookbook/entries")
      );
    });
  });
});
