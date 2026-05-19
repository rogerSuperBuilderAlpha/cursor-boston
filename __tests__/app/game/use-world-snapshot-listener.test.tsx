/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";

const unsubscribe = jest.fn();
const onSnapshot = jest.fn();

jest.mock("@/lib/firebase", () => ({
  db: { kind: "firestore" },
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ path: "game_world_snapshots/latest" })),
  onSnapshot: (...args: unknown[]) => onSnapshot(...args),
  Timestamp: class {},
}));

describe("useWorldSnapshotListener", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe.mockClear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("attaches, parses a delivered snapshot, and detaches on unmount", async () => {
    onSnapshot.mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        data: () => ({
          tiles: [],
          owners: [],
          generatedAt: "2026-05-01T00:00:00.000Z",
          tileCount: 0,
          ownerCount: 0,
        }),
      });
      return unsubscribe;
    });

    const hook = await import("@/app/game/_lib/use-world-snapshot-listener");
    const rendered = renderHook(() => hook.useWorldSnapshotListener());

    await waitFor(() => {
      expect(rendered.result.current.connected).toBe(true);
      expect(rendered.result.current.snapshot?.tileCount).toBe(0);
    });

    rendered.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("reports listener errors and skips when disabled", async () => {
    onSnapshot.mockImplementation((_ref, _next, error) => {
      window.setTimeout(() => error({ message: "permission denied" }), 0);
      return unsubscribe;
    });

    const { useWorldSnapshotListener } = await import(
      "@/app/game/_lib/use-world-snapshot-listener"
    );
    const rendered = renderHook(() => useWorldSnapshotListener());

    await waitFor(() => {
      expect(rendered.result.current.error).toMatch(/permission denied/i);
      expect(rendered.result.current.connected).toBe(false);
    });

    rendered.unmount();

    onSnapshot.mockClear();
    renderHook(() => useWorldSnapshotListener({ enabled: false }));
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
