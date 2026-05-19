/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";

const mockVerifyPhoneNumber = jest.fn();
const mockGetSession = jest.fn();
const mockEnroll = jest.fn();
const mockUnenroll = jest.fn();
const mockCredential = jest.fn();
const mockAssertion = jest.fn();
const mockRecaptchaClear = jest.fn();
const mockMultiFactor = jest.fn();

jest.mock("@/lib/firebase", () => ({
  auth: {},
}));

jest.mock("firebase/auth", () => ({
  PhoneAuthProvider: Object.assign(
    jest.fn().mockImplementation(() => ({
      verifyPhoneNumber: mockVerifyPhoneNumber,
    })),
    {
      credential: (...args: unknown[]) => mockCredential(...args),
    }
  ),
  PhoneMultiFactorGenerator: {
    FACTOR_ID: "phone",
    assertion: (...args: unknown[]) => mockAssertion(...args),
  },
  RecaptchaVerifier: jest.fn().mockImplementation(() => ({
    clear: mockRecaptchaClear,
  })),
  multiFactor: (...args: unknown[]) => mockMultiFactor(...args),
}));

import { useMfaEnrollment } from "@/app/(auth)/profile/_hooks/useMfaEnrollment";

function makeUser(overrides: Partial<{ reload: jest.Mock }> = {}) {
  return {
    reload: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as User;
}

function mockFactors(factors: Array<{ factorId: string; uid: string }>) {
  mockMultiFactor.mockReturnValue({
    enrolledFactors: factors,
    getSession: mockGetSession,
    enroll: mockEnroll,
    unenroll: mockUnenroll,
  });
}

describe("useMfaEnrollment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFactors([]);
    mockGetSession.mockResolvedValue({ session: "sess" });
    mockVerifyPhoneNumber.mockResolvedValue("verification-id-123");
    mockCredential.mockReturnValue({ cred: true });
    mockAssertion.mockReturnValue({ assertion: true });
    mockEnroll.mockResolvedValue(undefined);
    mockUnenroll.mockResolvedValue(undefined);
  });

  it("starts with empty enrollment state", () => {
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    expect(result.current.hasPhoneMfa).toBe(false);
    expect(result.current.verificationId).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sendCode rejects empty phone numbers", async () => {
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    await act(async () => {
      await result.current.sendCode();
    });

    expect(result.current.error).toMatch(/E\.164/);
    expect(mockVerifyPhoneNumber).not.toHaveBeenCalled();
  });

  it("sendCode rejects when phone MFA is already enabled", async () => {
    mockFactors([{ factorId: "phone", uid: "factor-1" }]);
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });

    await act(async () => {
      await result.current.sendCode();
    });

    expect(result.current.error).toMatch(/already enabled/i);
    expect(mockVerifyPhoneNumber).not.toHaveBeenCalled();
  });

  it("sendCode sends verification SMS on success", async () => {
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });

    await act(async () => {
      await result.current.sendCode();
    });

    await waitFor(() => {
      expect(result.current.verificationId).toBe("verification-id-123");
    });
    expect(result.current.success).toMatch(/sent/i);
    expect(mockVerifyPhoneNumber).toHaveBeenCalledWith(
      { phoneNumber: "+15551234567", session: { session: "sess" } },
      expect.any(Object)
    );
  });

  it("sendCode surfaces errors from Firebase", async () => {
    mockVerifyPhoneNumber.mockRejectedValue(new Error("network"));
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });

    await act(async () => {
      await result.current.sendCode();
    });

    expect(result.current.error).toMatch(/Failed to send verification code/i);
    expect(result.current.loading).toBe(false);
  });

  it("confirmEnrollment requires an SMS code", async () => {
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });
    await act(async () => {
      await result.current.sendCode();
    });

    await act(async () => {
      await result.current.confirmEnrollment();
    });

    expect(result.current.error).toMatch(/Enter the SMS code/i);
    expect(mockEnroll).not.toHaveBeenCalled();
  });

  it("confirmEnrollment enrolls phone MFA and clears form state", async () => {
    const reload = jest.fn().mockResolvedValue(undefined);
    const user = makeUser({ reload });
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });
    await act(async () => {
      await result.current.sendCode();
    });

    act(() => {
      result.current.setSmsCode("123456");
    });

    await act(async () => {
      await result.current.confirmEnrollment();
    });

    expect(mockCredential).toHaveBeenCalledWith("verification-id-123", "123456");
    expect(mockEnroll).toHaveBeenCalledWith({ assertion: true }, "Phone");
    expect(reload).toHaveBeenCalled();
    expect(result.current.success).toMatch(/enabled/i);
    expect(result.current.verificationId).toBeNull();
    expect(result.current.smsCode).toBe("");
    expect(result.current.phoneNumber).toBe("");
  });

  it("confirmEnrollment surfaces enrollment failures", async () => {
    mockEnroll.mockRejectedValue(new Error("bad code"));
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });
    await act(async () => {
      await result.current.sendCode();
    });
    act(() => {
      result.current.setSmsCode("000000");
    });

    await act(async () => {
      await result.current.confirmEnrollment();
    });

    expect(result.current.error).toMatch(/Failed to enable 2FA/i);
  });

  it("disable unenrolls the phone factor", async () => {
    mockFactors([{ factorId: "phone", uid: "factor-1" }]);
    const reload = jest.fn().mockResolvedValue(undefined);
    const user = makeUser({ reload });
    const { result } = renderHook(() => useMfaEnrollment(user));

    await act(async () => {
      await result.current.disable();
    });

    expect(mockUnenroll).toHaveBeenCalledWith("factor-1");
    expect(reload).toHaveBeenCalled();
    expect(result.current.success).toMatch(/disabled/i);
  });

  it("disable errors when no phone factor is enrolled", async () => {
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    await act(async () => {
      await result.current.disable();
    });

    expect(result.current.error).toMatch(/No phone-based 2FA/i);
    expect(mockUnenroll).not.toHaveBeenCalled();
  });

  it("disable surfaces unenroll failures", async () => {
    mockFactors([{ factorId: "phone", uid: "factor-1" }]);
    mockUnenroll.mockRejectedValue(new Error("fail"));
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    await act(async () => {
      await result.current.disable();
    });

    expect(result.current.error).toMatch(/Failed to disable 2FA/i);
  });

  it("clearRecaptcha clears the verifier instance", () => {
    const user = makeUser();
    const { result } = renderHook(() => useMfaEnrollment(user));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });

    act(() => {
      void result.current.sendCode();
    });

    act(() => {
      result.current.clearRecaptcha();
    });

    expect(mockRecaptchaClear).toHaveBeenCalled();
  });

  it("no-ops sendCode when user is null", async () => {
    const { result } = renderHook(() => useMfaEnrollment(null));

    act(() => {
      result.current.setPhoneNumber("+15551234567");
    });

    await act(async () => {
      await result.current.sendCode();
    });

    expect(mockVerifyPhoneNumber).not.toHaveBeenCalled();
  });
});
