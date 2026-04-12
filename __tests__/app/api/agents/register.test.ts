/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/agents/register/route";

const mockCreateAgent = jest.fn();
const mockGetVerifiedAgent = jest.fn();

jest.mock("@/lib/agents", () => ({
  createAgent: (...args: unknown[]) => mockCreateAgent(...args),
  getVerifiedAgent: (...args: unknown[]) => mockGetVerifiedAgent(...args),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/agents/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost:3000" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agents/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedAgent.mockResolvedValue(null);
    mockCreateAgent.mockResolvedValue({
      agent: { id: "agent-1", name: "TestBot", description: "", status: "unclaimed" },
      apiKey: "cb_agent_xxx",
      claimUrl: "/agents/claim/token123",
    });
  });

  it("returns 409 if agent already registered", async () => {
    mockGetVerifiedAgent.mockResolvedValue({ id: "existing", name: "Bot", status: "claimed" });
    const res = await POST(makeRequest({ name: "Bot" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for name too short", async () => {
    const res = await POST(makeRequest({ name: "A" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for name too long", async () => {
    const res = await POST(makeRequest({ name: "A".repeat(51) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid name characters", async () => {
    const res = await POST(makeRequest({ name: "Bot@Special!" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for description too long", async () => {
    const res = await POST(makeRequest({ name: "TestBot", description: "A".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("creates agent and returns API key on success", async () => {
    const res = await POST(makeRequest({ name: "TestBot", description: "A test bot" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.apiKey).toBe("cb_agent_xxx");
    expect(body.agent.id).toBe("agent-1");
    expect(body.claimUrl).toContain("/agents/claim/token123");
    expect(mockCreateAgent).toHaveBeenCalledWith("TestBot", "A test bot");
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
