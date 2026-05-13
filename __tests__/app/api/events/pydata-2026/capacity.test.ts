/**
 * @jest-environment node
 */

import { GET } from "@/app/api/events/pydata-2026/capacity/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { PYDATA_2026_CAPACITY } from "@/lib/pydata-2026";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function buildDb(count: number) {
  const countSnap = { data: () => ({ count }) };
  const countQuery = { get: jest.fn().mockResolvedValue(countSnap) };
  const whereChain = { count: jest.fn().mockReturnValue(countQuery) };
  const collection = { where: jest.fn().mockReturnValue(whereChain) };
  const db: any = { collection: jest.fn().mockReturnValue(collection) };
  return { db };
}

describe("GET /api/events/pydata-2026/capacity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockAdminDb.mockReturnValue(null as any);
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns the capacity, claimed count, remaining, and full=false when under capacity", async () => {
    const { db } = buildDb(50);
    mockAdminDb.mockReturnValue(db);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.capacity).toBe(PYDATA_2026_CAPACITY);
    expect(json.claimed).toBe(50);
    expect(json.remaining).toBe(PYDATA_2026_CAPACITY - 50);
    expect(json.full).toBe(false);
  });

  it("returns full=true and remaining=0 when at exactly capacity", async () => {
    const { db } = buildDb(PYDATA_2026_CAPACITY);
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET()).json();
    expect(json.full).toBe(true);
    expect(json.remaining).toBe(0);
  });

  it("clamps remaining to 0 when claimed exceeds capacity", async () => {
    const { db } = buildDb(PYDATA_2026_CAPACITY + 10);
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET()).json();
    expect(json.remaining).toBe(0);
    expect(json.full).toBe(true);
  });
});
