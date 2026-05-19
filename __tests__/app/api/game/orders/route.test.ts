/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game orders route GET/POST/DELETE guards.
 */
import { DELETE, GET, POST } from "@/app/api/game/orders/route";
import {
  cancelOrderServer,
  enqueueOrderServer,
  listOrdersForPlayerServer,
} from "@/lib/game/orders";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/game/orders", () => ({
  listOrdersForPlayerServer: jest.fn(),
  enqueueOrderServer: jest.fn(),
  cancelOrderServer: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockListOrders = listOrdersForPlayerServer as jest.MockedFunction<
  typeof listOrdersForPlayerServer
>;
const mockEnqueueOrder = enqueueOrderServer as jest.MockedFunction<typeof enqueueOrderServer>;
const mockCancelOrder = cancelOrderServer as jest.MockedFunction<typeof cancelOrderServer>;

describe("GET /api/game/orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/orders" }));
    expect(res.status).toBe(401);
  });

  it("returns queued orders for authed user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockListOrders.mockResolvedValue([{ id: "ord-1" }] as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/orders" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, orders: [{ id: "ord-1" }] });
    expect(mockListOrders).toHaveBeenCalledWith("u1", false);
  });
});

describe("POST /api/game/orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/orders",
        body: { kind: "recruit_on_tile", tileId: "t1", unitType: "ground" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown order kind", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/orders",
        body: { kind: "invalid_kind" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 when enqueue succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockEnqueueOrder.mockResolvedValue({ id: "ord-new" } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/orders",
          body: {
            kind: "recruit_on_tile",
            tileId: "t1",
            unitType: "ground",
          },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, order: { id: "ord-new" } });
  });
});

describe("DELETE /api/game/orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await DELETE(
      makeRequest({
        method: "DELETE",
        path: "/api/game/orders",
        searchParams: { orderId: "ord-1" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when orderId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await DELETE(makeAuthedRequest({ method: "DELETE", path: "/api/game/orders" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 when cancel succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCancelOrder.mockResolvedValue({ id: "ord-1", status: "cancelled" } as never);

    const { status, body } = await readJson(
      await DELETE(
        makeAuthedRequest({
          method: "DELETE",
          path: "/api/game/orders",
          searchParams: { orderId: "ord-1" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, order: { id: "ord-1" } });
    expect(mockCancelOrder).toHaveBeenCalledWith({
      orderId: "ord-1",
      callerUserId: "u1",
    });
  });
});
