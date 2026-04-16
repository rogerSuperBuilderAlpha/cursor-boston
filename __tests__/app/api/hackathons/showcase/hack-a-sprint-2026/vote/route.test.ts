/**
 * @jest-environment node
 */

import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/vote/route";

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/vote (legacy)", () => {
  it("returns 410 with retirement message", async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toContain("retired");
    expect(body.error).toContain("participant-score");
  });
});
