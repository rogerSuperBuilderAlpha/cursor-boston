/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/notify-admin/talk/route";

const mockSendEmail = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/mailgun", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/notify-admin/talk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  title: "AI in Production",
  description: "A talk about AI",
  category: "tech",
  duration: "30min",
  experience: "intermediate",
  bio: "Engineer",
};

describe("POST /api/notify-admin/talk", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ name: "Jane" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(makeRequest({ email: "j@e.com", title: "T" }));
    expect(res.status).toBe(400);
  });

  it("sends email and returns 200 on success", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("AI in Production"),
      })
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/notify-admin/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when email sending fails", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
