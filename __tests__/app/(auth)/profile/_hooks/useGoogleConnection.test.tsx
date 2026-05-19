/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #7 — useGoogleConnection (was 0% coverage).
 */
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import { unlink } from "firebase/auth";
import { useGoogleConnection } from "@/app/(auth)/profile/_hooks/useGoogleConnection";

jest.mock("firebase/auth", () => ({
  unlink: jest.fn(),
  User: class {},
}));
jest.mock("@/lib/firebase", () => ({
  auth: { currentUser: null },
}));

const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

function makeUser(providers: string[]): User {
  return {
    providerData: providers.map((id) => ({ providerId: id })),
    reload: jest.fn().mockResolvedValue(undefined),
  } as unknown as User;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useGoogleConnection", () => {
  it("flags hasGoogleProvider when providerData includes google.com", () => {
    const user = makeUser(["google.com", "password"]);
    const { result } = renderHook(() => useGoogleConnection(user));
    expect(result.current.hasGoogleProvider).toBe(true);
    expect(result.current.hasPasswordProvider).toBe(true);
    expect(result.current.canDisconnect).toBe(true);
  });

  it("flags hasGoogleProvider=false when not in providerData", () => {
    const user = makeUser(["password"]);
    const { result } = renderHook(() => useGoogleConnection(user));
    expect(result.current.hasGoogleProvider).toBe(false);
    expect(result.current.canDisconnect).toBe(false);
  });

  it("returns empty providerIds when user is null", () => {
    const { result } = renderHook(() => useGoogleConnection(null));
    expect(result.current.hasGoogleProvider).toBe(false);
    expect(result.current.hasPasswordProvider).toBe(false);
    expect(result.current.canDisconnect).toBe(false);
  });

  it("canDisconnect=false when google is the only provider", () => {
    const user = makeUser(["google.com"]);
    const { result } = renderHook(() => useGoogleConnection(user));
    expect(result.current.hasGoogleProvider).toBe(true);
    expect(result.current.canDisconnect).toBe(false);
  });

  it("disconnect is a no-op when user is null", async () => {
    const { result } = renderHook(() => useGoogleConnection(null));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(mockUnlink).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("disconnect sets error when canDisconnect is false", async () => {
    const user = makeUser(["google.com"]);
    const { result } = renderHook(() => useGoogleConnection(user));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.error).toContain("at least one other login method");
    expect(result.current.disconnecting).toBe(false);
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("disconnect calls unlink and flips wasDisconnected on success", async () => {
    const user = makeUser(["google.com", "password"]);
    mockUnlink.mockResolvedValue({} as never);
    const { result } = renderHook(() => useGoogleConnection(user));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(mockUnlink).toHaveBeenCalledWith(user, "google.com");
    expect(user.reload).toHaveBeenCalled();
    expect(result.current.hasGoogleProvider).toBe(false); // wasDisconnected wins
    expect(result.current.disconnecting).toBe(false);
  });

  it("disconnect sets error when unlink throws", async () => {
    const user = makeUser(["google.com", "password"]);
    mockUnlink.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useGoogleConnection(user));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.error).toContain("Failed to disconnect Google");
    expect(result.current.disconnecting).toBe(false);
  });

  it("resetIfReconnected clears wasDisconnected when google reappears", async () => {
    const user = makeUser(["google.com", "password"]);
    mockUnlink.mockResolvedValue({} as never);
    const { result, rerender } = renderHook(
      ({ u }: { u: User }) => useGoogleConnection(u),
      { initialProps: { u: user } },
    );

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.hasGoogleProvider).toBe(false);

    // Reconnect: provider re-appears (e.g. user re-linked) and we call
    // resetIfReconnected. wasDisconnected flips back to false.
    const reconnectedUser = makeUser(["google.com", "password"]);
    rerender({ u: reconnectedUser });

    act(() => {
      result.current.resetIfReconnected();
    });

    expect(result.current.hasGoogleProvider).toBe(true);
  });

  it("resetIfReconnected is a no-op when google still missing", () => {
    const user = makeUser(["password"]);
    const { result } = renderHook(() => useGoogleConnection(user));
    act(() => {
      result.current.resetIfReconnected();
    });
    expect(result.current.hasGoogleProvider).toBe(false);
  });

  it("setError exposed for callers to clear external errors", () => {
    const user = makeUser(["google.com", "password"]);
    const { result } = renderHook(() => useGoogleConnection(user));
    act(() => {
      result.current.setError("forced error");
    });
    expect(result.current.error).toBe("forced error");
    act(() => {
      result.current.setError(null);
    });
    expect(result.current.error).toBeNull();
  });

  it("returns empty providerIds when user has no providerData", () => {
    const user = { providerData: undefined } as unknown as User;
    const { result } = renderHook(() => useGoogleConnection(user));
    expect(result.current.hasGoogleProvider).toBe(false);
  });
});
