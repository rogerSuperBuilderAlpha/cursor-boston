import {
  MAINTAINER_ZOOM_JOIN_URL,
  MAINTAINER_ZOOM_MEETING_ID,
  MAINTAINER_ZOOM_MEETING_ID_DISPLAY,
  MAINTAINER_ZOOM_ONE_TAP,
  MAINTAINER_ZOOM_ORGANIZER,
} from "@/lib/maintainer-meeting";

describe("maintainer-meeting constants", () => {
  it("exposes a Zoom join URL pointing at the bentley.zoom.us tenant", () => {
    expect(MAINTAINER_ZOOM_JOIN_URL).toMatch(/^https:\/\/bentley\.zoom\.us\/j\/\d+$/);
  });

  it("keeps the meeting id and join URL in sync", () => {
    expect(MAINTAINER_ZOOM_JOIN_URL.endsWith(`/${MAINTAINER_ZOOM_MEETING_ID}`)).toBe(true);
  });

  it("renders the display-formatted meeting id without spaces equal to the raw id", () => {
    expect(MAINTAINER_ZOOM_MEETING_ID_DISPLAY.replace(/\s/g, "")).toBe(
      MAINTAINER_ZOOM_MEETING_ID
    );
  });

  it("names a human organizer", () => {
    expect(MAINTAINER_ZOOM_ORGANIZER.length).toBeGreaterThan(0);
  });

  it("provides one-tap dial entries that reference the meeting id", () => {
    expect(MAINTAINER_ZOOM_ONE_TAP.length).toBeGreaterThan(0);
    for (const entry of MAINTAINER_ZOOM_ONE_TAP) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.href).toMatch(new RegExp(`tel:\\+\\d+,,${MAINTAINER_ZOOM_MEETING_ID}#`));
    }
  });
});
