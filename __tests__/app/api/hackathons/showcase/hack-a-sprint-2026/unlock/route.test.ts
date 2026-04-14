/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/unlock/route";

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/unlock", () => {
  it("returns 410 — passcode flow removed; check-in is the gate", async () => {
    const req = new NextRequest("http://localhost/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "any" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("Passcode unlock has been removed");
  });
});
