/**
 * @jest-environment node
 */

import { GET } from "@/app/api/tips/route";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetPublishedTips = jest.fn();
jest.mock("@/lib/tips", () => ({
  getPublishedTips: () => mockGetPublishedTips(),
}));

describe("GET /api/tips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns published tips", async () => {
    const tips = [
      { id: "1", title: "Tip 1", content: "Content 1", status: "published" },
      { id: "2", title: "Tip 2", content: "Content 2", status: "published" },
    ];
    mockGetPublishedTips.mockResolvedValue(tips);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tips).toHaveLength(2);
    expect(data.tips[0].title).toBe("Tip 1");
  });

  it("returns empty array when no tips exist", async () => {
    mockGetPublishedTips.mockResolvedValue([]);
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tips).toHaveLength(0);
  });

  it("returns 500 on error", async () => {
    mockGetPublishedTips.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
