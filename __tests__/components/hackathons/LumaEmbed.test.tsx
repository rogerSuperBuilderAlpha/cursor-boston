/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { LumaEmbed } from "@/components/hackathons/LumaEmbed";

describe("LumaEmbed", () => {
  it("renders an iframe pointed at the Luma embed URL for the given event id", () => {
    render(<LumaEmbed embedId="evt-abc123" title="My event" />);
    const iframe = screen.getByTitle("My event") as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe(
      "https://luma.com/embed/event/evt-abc123/simple"
    );
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.getAttribute("allow")).toContain("fullscreen");
  });

  it("defaults to a square aspect ratio and respects overrides", () => {
    const { container: sq } = render(
      <LumaEmbed embedId="evt-1" title="square" />
    );
    expect(sq.querySelector("iframe")?.className).toContain("aspect-square");

    const { container: vid } = render(
      <LumaEmbed embedId="evt-2" title="video" aspect="video" />
    );
    expect(vid.querySelector("iframe")?.className).toContain("aspect-video");

    const { container: portrait } = render(
      <LumaEmbed embedId="evt-3" title="portrait" aspect="portrait" />
    );
    expect(portrait.querySelector("iframe")?.className).toContain("aspect-[3/4]");
  });
});
