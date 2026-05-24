/**
 * @jest-environment jsdom
 *
 * The big branching here is the CTA copy ladder — signed-out, signed-in
 * without a kingdom, signed-in with a kingdom — plus the lazy player
 * probe. The three.js scene gets mocked out so the test renders the
 * surrounding HUD / CTA / drawer in jsdom; the actual WebGL render is
 * outside this suite's scope.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { World3DTile } from "@/lib/game/world-snapshot-3d";

// The Scene is a heavy three.js bundle loaded via next/dynamic. We stub
// the dynamic import so jsdom doesn't try to evaluate WebGL.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    return function MockScene() {
      return <div data-testid="mock-scene" />;
    };
  },
}));

// useAuth gets swapped per-test via mockReturnValue.
const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const TILES: World3DTile[] = [
  {
    tileId: "tile-1",
    q: 0,
    r: 0,
    type: "military",
    ownerId: "u-1",
    ownerName: "Ada",
    caste: "green",
    isNpc: false,
    level: 2,
    hasExtraForces: false,
    hasHero: false,
    ownerShielded: false,
  },
];

// Re-import after each `jest.resetModules()` so the dynamic-import mock
// reapplies cleanly when needed.
let World3DClient: typeof import("@/app/game/world/_components/World3DClient").World3DClient;
beforeAll(async () => {
  ({ World3DClient } = await import(
    "@/app/game/world/_components/World3DClient"
  ));
});

beforeEach(() => {
  mockUseAuth.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe("World3DClient — CTA ladder", () => {
  it("renders 'Sign in to play' for signed-out visitors", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    const cta = screen.getByRole("link", { name: "Sign in to play" });
    expect(cta).toHaveAttribute("href", "/login");
  });

  it("renders the loading-spinner copy while auth is settling", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    // CTA shows the ellipsis placeholder, not a real label.
    expect(screen.getByRole("link", { name: "…" })).toBeInTheDocument();
  });

  it("renders neutral 'Access game' for signed-in users while the kingdom probe is in flight", async () => {
    // fetch hangs forever — probe never resolves.
    global.fetch = jest.fn(() => new Promise(() => undefined)) as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: { uid: "u-1", getIdToken: async () => "tok" },
      loading: false,
    });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    const cta = await screen.findByRole("link", { name: "Access game" });
    expect(cta).toHaveAttribute("href", "/game");
  });

  it("flips to 'Manage kingdom' once the probe returns a player", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ player: { uid: "u-1" } }),
    })) as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: { uid: "u-1", getIdToken: async () => "tok" },
      loading: false,
    });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Manage kingdom" })
      ).toBeInTheDocument();
    });
  });

  it("flips to 'Create my kingdom' when the user has no player record", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ player: null }),
    })) as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: { uid: "u-1", getIdToken: async () => "tok" },
      loading: false,
    });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Create my kingdom" })
      ).toBeInTheDocument();
    });
  });

  it("stays on neutral copy when the probe fetch fails", async () => {
    global.fetch = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: { uid: "u-1", getIdToken: async () => "tok" },
      loading: false,
    });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Access game" })
      ).toBeInTheDocument();
    });
  });

  it("swallows the probe-fetch exception without crashing the page", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: { uid: "u-1", getIdToken: async () => "tok" },
      loading: false,
    });
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    await waitFor(() => {
      // Page still rendered; neutral CTA still present.
      expect(
        screen.getByRole("link", { name: "Access game" })
      ).toBeInTheDocument();
    });
  });
});

describe("World3DClient — HUD chrome", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
  });

  it("renders the Generals title + tagline + pan/zoom hint", () => {
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    expect(
      screen.getByRole("heading", { name: "Generals" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/turn-based realm where every PR/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag to fly across the map/)
    ).toBeInTheDocument();
  });

  it("renders the snapshot date when generatedAt is provided", () => {
    render(
      <World3DClient
        initialTiles={TILES}
        generatedAt="2026-05-23T16:17:22Z"
      />
    );
    expect(screen.getByText(/Snapshot: /)).toBeInTheDocument();
  });

  it("omits the snapshot date when generatedAt is null", () => {
    render(<World3DClient initialTiles={TILES} generatedAt={null} />);
    expect(screen.queryByText(/Snapshot: /)).not.toBeInTheDocument();
  });

  it("shows the empty-state banner when initialTiles is empty", () => {
    render(<World3DClient initialTiles={[]} generatedAt={null} />);
    expect(
      screen.getByText(/world hasn't been snapshotted yet/)
    ).toBeInTheDocument();
  });

  it("opens the How-to-play drawer when the bottom-left button is clicked", () => {
    const { container } = render(
      <World3DClient initialTiles={TILES} generatedAt={null} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "How to read this map" })
    );
    // Drawer's heading appears in the DOM once open.
    expect(
      screen.getByRole("heading", { name: "How to read this map" })
    ).toBeInTheDocument();
    // The aside transitions but should be aria-hidden=false when open.
    const aside = container.querySelector("aside");
    expect(aside).toHaveAttribute("aria-hidden", "false");
  });
});
