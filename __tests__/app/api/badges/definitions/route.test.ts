/**
 * @jest-environment node
 */

import { GET } from "@/app/api/badges/definitions/route";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";

describe("GET /api/badges/definitions", () => {
  it("returns the local BADGE_DEFINITIONS constant", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("local");
    expect(body.definitions).toEqual(BADGE_DEFINITIONS);
  });

  it("sets cache headers for edge caching", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate=300");
  });
});
