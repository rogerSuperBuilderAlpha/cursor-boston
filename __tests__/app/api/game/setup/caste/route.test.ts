/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #4 — full coverage for setup/caste route.
 */
import { POST } from "@/app/api/game/setup/caste/route";
import { chooseCasteServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => {
  const actual = jest.requireActual("@/lib/game/data-server");
  return { ...actual, chooseCasteServer: jest.fn() };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockChooseCaste = chooseCasteServer as jest.MockedFunction<typeof chooseCasteServer>;

describe("POST /api/game/setup/caste", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockChooseCaste.mockResolvedValue({ userId: "u1", caste: "red" } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/setup/caste", body: { caste: "red" } }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/setup/caste",
        body: "not-json",
        headers: { Authorization: "Bearer test", "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when caste is missing from body (zod validation fails)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const res = await POST(
      makeAuthedRequest({ method: "POST", path: "/api/game/setup/caste", body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful caste choice", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/setup/caste", body: { caste: "red" } }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(mockChooseCaste).toHaveBeenCalledWith("u1", "red");
  });

  it("returns 500 via mapGameError when chooseCasteServer throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    mockChooseCaste.mockRejectedValue(new Error("caste service down"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/setup/caste", body: { caste: "red" } }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
