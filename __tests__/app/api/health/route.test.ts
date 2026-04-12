/**
 * @jest-environment node
 */

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with healthy status", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.timestamp).toBeDefined();
    expect(typeof body.timestamp).toBe("string");
  });

  it("includes a version field", async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe("string");
  });

  it("returns a valid ISO timestamp", async () => {
    const res = await GET();
    const body = await res.json();

    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });
});
