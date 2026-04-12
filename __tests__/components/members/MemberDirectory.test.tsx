import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicMember, MemberFilters, SortOption } from "@/types/members";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

// Mock next/link
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Firebase client
jest.mock("@/lib/firebase", () => ({ db: null }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock MemberCard to keep tests focused on directory logic
jest.mock("@/components/members/MemberCard", () => ({
  MemberCard: ({ member }: { member: PublicMember }) => (
    <div data-testid="member-card">{member.displayName}</div>
  ),
}));

// Mock skeleton
jest.mock("@/components/skeletons/MemberCardSkeleton", () => ({
  MemberCardSkeleton: () => <div data-testid="member-skeleton" />,
}));

// --- useMembers mock state ---
type SetFilters = (fn: (f: MemberFilters) => MemberFilters) => void;

const defaultFilters: MemberFilters = {
  hasDiscord: false,
  hasLinkedIn: false,
  hasTwitter: false,
  hasGithub: false,
  hasSubstack: false,
  hasWebsite: false,
  memberType: "all",
};

let mockHookReturn: {
  members: PublicMember[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: jest.Mock;
  filters: MemberFilters;
  setFilters: jest.Mock<void, [fn: (f: MemberFilters) => MemberFilters]>;
  sortBy: SortOption;
  setSortBy: jest.Mock;
  filteredAndSortedMembers: PublicMember[];
  activeFilterCount: number;
  clearFilters: jest.Mock;
};

function buildMockHook(overrides: Partial<typeof mockHookReturn> = {}) {
  mockHookReturn = {
    members: [],
    loading: false,
    searchQuery: "",
    setSearchQuery: jest.fn(),
    filters: defaultFilters,
    setFilters: jest.fn(),
    sortBy: "newest" as SortOption,
    setSortBy: jest.fn(),
    filteredAndSortedMembers: [],
    activeFilterCount: 0,
    clearFilters: jest.fn(),
    ...overrides,
  };
}

jest.mock("@/hooks/useMembers", () => ({
  useMembers: () => mockHookReturn,
}));

import { MemberDirectory } from "@/components/members/MemberDirectory";

function buildMember(overrides: Partial<PublicMember> = {}): PublicMember {
  return {
    uid: "user-1",
    displayName: "Jane Doe",
    photoURL: null,
    memberType: "human",
    ...overrides,
  };
}

describe("MemberDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders skeletons while loading", () => {
      buildMockHook({ loading: true });
      render(<MemberDirectory />);
      const skeletons = screen.getAllByTestId("member-skeleton");
      expect(skeletons).toHaveLength(6);
    });

    it("does not render search controls while loading", () => {
      buildMockHook({ loading: true });
      render(<MemberDirectory />);
      expect(screen.queryByPlaceholderText(/Search by name/)).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no members exist", () => {
      buildMockHook({ members: [], loading: false });
      render(<MemberDirectory />);
      expect(screen.getByText("No public profiles yet.")).toBeInTheDocument();
    });

    it("links to profile page in empty state", () => {
      buildMockHook({ members: [], loading: false });
      render(<MemberDirectory />);
      const link = screen.getByText("make your profile public");
      expect(link).toHaveAttribute("href", "/profile");
    });
  });

  describe("no results state", () => {
    it("shows no-results message when filters yield zero", () => {
      const member = buildMember();
      buildMockHook({
        members: [member],
        filteredAndSortedMembers: [],
        loading: false,
      });
      render(<MemberDirectory />);
      expect(screen.getByText("No members match your search.")).toBeInTheDocument();
    });

    it("has a clear filters button in no-results state", async () => {
      const member = buildMember();
      buildMockHook({
        members: [member],
        filteredAndSortedMembers: [],
        loading: false,
      });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      const clearBtn = screen.getByText("Clear filters");
      await user.click(clearBtn);
      expect(mockHookReturn.clearFilters).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/members", { scroll: false });
    });
  });

  describe("member list rendering", () => {
    it("renders member cards for each filtered member", () => {
      const members = [
        buildMember({ uid: "u1", displayName: "Alice" }),
        buildMember({ uid: "u2", displayName: "Bob" }),
      ];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      render(<MemberDirectory />);
      const cards = screen.getAllByTestId("member-card");
      expect(cards).toHaveLength(2);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("displays total member count when not filtered", () => {
      const members = [
        buildMember({ uid: "u1" }),
        buildMember({ uid: "u2" }),
        buildMember({ uid: "u3" }),
      ];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      render(<MemberDirectory />);
      expect(screen.getByText("3 members")).toBeInTheDocument();
    });

    it("displays filtered count when search narrows results", () => {
      const allMembers = [
        buildMember({ uid: "u1" }),
        buildMember({ uid: "u2" }),
        buildMember({ uid: "u3" }),
      ];
      const filtered = [allMembers[0]];
      buildMockHook({ members: allMembers, filteredAndSortedMembers: filtered, loading: false });
      render(<MemberDirectory />);
      expect(screen.getByText("1 of 3 members")).toBeInTheDocument();
    });

    it("uses singular 'member' for count of 1", () => {
      const members = [buildMember({ uid: "u1" })];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      render(<MemberDirectory />);
      expect(screen.getByText("1 member")).toBeInTheDocument();
    });
  });

  describe("search", () => {
    it("renders the search input", () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      render(<MemberDirectory />);
      expect(screen.getByPlaceholderText("Search by name, location, job, bio...")).toBeInTheDocument();
    });

    it("calls setSearchQuery on input change", async () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      const input = screen.getByPlaceholderText("Search by name, location, job, bio...");
      await user.type(input, "test");
      expect(mockHookReturn.setSearchQuery).toHaveBeenCalled();
    });
  });

  describe("sort dropdown", () => {
    it("renders the sort dropdown with options", () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      render(<MemberDirectory />);
      const select = screen.getByDisplayValue("Newest Members");
      expect(select).toBeInTheDocument();
    });

    it("calls setSortBy when sort option changes", async () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      const select = screen.getByDisplayValue("Newest Members");
      await user.selectOptions(select, "name");
      expect(mockHookReturn.setSortBy).toHaveBeenCalledWith("name");
    });
  });

  describe("filter panel", () => {
    it("toggles filter panel on button click", async () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      const user = userEvent.setup();
      render(<MemberDirectory />);

      expect(screen.queryByText("Member type")).not.toBeInTheDocument();
      await user.click(screen.getByText("Filters"));
      expect(screen.getByText("Member type")).toBeInTheDocument();
    });

    it("shows active filter count badge", () => {
      const members = [buildMember()];
      buildMockHook({
        members,
        filteredAndSortedMembers: members,
        loading: false,
        activeFilterCount: 2,
      });
      render(<MemberDirectory />);
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders member type filter buttons", async () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      await user.click(screen.getByText("Filters"));

      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Humans")).toBeInTheDocument();
      expect(screen.getByText("Agents")).toBeInTheDocument();
    });

    it("calls setFilters when member type button is clicked", async () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      await user.click(screen.getByText("Filters"));
      await user.click(screen.getByText("Agents"));
      expect(mockHookReturn.setFilters).toHaveBeenCalled();
    });

    it("renders connected account filter checkboxes", async () => {
      const members = [buildMember()];
      buildMockHook({ members, filteredAndSortedMembers: members, loading: false });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      await user.click(screen.getByText("Filters"));

      expect(screen.getByText("Discord")).toBeInTheDocument();
      expect(screen.getByText("LinkedIn")).toBeInTheDocument();
      expect(screen.getByText("X")).toBeInTheDocument();
      expect(screen.getByText("GitHub")).toBeInTheDocument();
      expect(screen.getByText("Substack")).toBeInTheDocument();
      expect(screen.getByText("Website")).toBeInTheDocument();
    });

    it("shows 'Clear all' button when filters are active", async () => {
      const members = [buildMember()];
      buildMockHook({
        members,
        filteredAndSortedMembers: members,
        loading: false,
        activeFilterCount: 1,
      });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      await user.click(screen.getByText("Filters"));
      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });

    it("calls clearFilters and navigates when 'Clear all' is clicked", async () => {
      const members = [buildMember()];
      buildMockHook({
        members,
        filteredAndSortedMembers: members,
        loading: false,
        activeFilterCount: 1,
      });
      const user = userEvent.setup();
      render(<MemberDirectory />);
      await user.click(screen.getByText("Filters"));
      await user.click(screen.getByText("Clear all"));
      expect(mockHookReturn.clearFilters).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/members", { scroll: false });
    });
  });
});
