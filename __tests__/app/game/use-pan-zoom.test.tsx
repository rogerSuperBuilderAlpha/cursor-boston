/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { usePanZoom } from "@/app/game/tiles/_lib/use-pan-zoom";

describe("usePanZoom", () => {
  it("zooms with controls, wheel, and document pointer drag", () => {
    const { result } = renderHook(() => usePanZoom());
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    act(() => {
      result.current.svgRef.current = svg;
    });

    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.scale).toBeGreaterThan(1);

    const scaleAfterZoomIn = result.current.scale;
    act(() => {
      result.current.zoomOut();
    });
    expect(result.current.scale).toBeLessThanOrEqual(scaleAfterZoomIn);

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        pointerType: "mouse",
        clientX: 10,
        clientY: 10,
      } as never);
    });
    expect(result.current.dragging).toBe(true);

    act(() => {
      const move = new Event("pointermove") as PointerEvent;
      Object.assign(move, { clientX: 40, clientY: 30 });
      document.dispatchEvent(move);
    });
    expect(result.current.lastDragMovedRef.current).toBeGreaterThan(0);
    expect(result.current.tx).not.toBe(0);

    act(() => {
      document.dispatchEvent(new Event("pointerup"));
    });
    expect(result.current.dragging).toBe(false);
  });
});
