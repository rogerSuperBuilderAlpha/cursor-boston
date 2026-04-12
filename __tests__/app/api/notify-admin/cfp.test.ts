/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/notify-admin/cfp/route";

const mockSendEmail = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/mailgun", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/notify-admin/cfp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  thesisTitle: "AI-Assisted Development Patterns",
  school: "MIT",
  department: "CS",
};

describe("POST /api/notify-admin/cfp", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ name: "Jane" }));
    expect(res.status).toBe(400);
  });

  it("sends email and returns 200 on success", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("AI-Assisted Development Patterns"),
      })
    );
  });

  it("returns 500 when email sending fails", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
