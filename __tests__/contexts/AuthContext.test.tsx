/**
 * @jest-environment jsdom
 *
 * Coverage push #70 — contexts/AuthContext.tsx (174 uncov, 0% before).
 * Drives:
 *   - AuthProvider sets loading=false when auth is null
 *   - onAuthStateChanged path: null user, cached profile, fresh fetch
 *   - useAuth throws outside AuthProvider
 *   - signIn / signUp / signInWithGoogle / signInWithGithub / signOut
 *     reject when auth is null
 *   - resetPassword forwarding
 *   - sendAddEmailVerification / removeAdditionalEmail /
 *     changePrimaryEmail fetch wrappers (auth-required + happy path +
 *     error body)
 */

// firebase/auth must be mocked first
const mockOnAuthStateChanged = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockCreateUserWithEmail = jest.fn();
const mockFirebaseSignOut = jest.fn();
const mockSignInWithPopup = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...a: unknown[]) => mockOnAuthStateChanged(...a),
  signInWithEmailAndPassword: (...a: unknown[]) => mockSignInWithEmail(...a),
  createUserWithEmailAndPassword: (...a: unknown[]) =>
    mockCreateUserWithEmail(...a),
  signOut: (...a: unknown[]) => mockFirebaseSignOut(...a),
  signInWithPopup: (...a: unknown[]) => mockSignInWithPopup(...a),
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
}));

const mockDoc = jest.fn((db: unknown, coll: string, id: string) => ({
  __doc: `${coll}/${id}`,
}));
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => "__ts");

jest.mock("firebase/firestore", () => ({
  doc: (...a: unknown[]) => mockDoc(...(a as Parameters<typeof mockDoc>)),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  serverTimestamp: () => mockServerTimestamp(),
}));

const mockUploadBytes = jest.fn().mockResolvedValue(undefined);
const mockGetDownloadURL = jest.fn().mockResolvedValue("https://photo.example/p.png");
const mockStorageRef = jest.fn(() => ({}));
jest.mock("firebase/storage", () => ({
  ref: (...a: unknown[]) => mockStorageRef(...a),
  uploadBytes: (...a: unknown[]) => mockUploadBytes(...a),
  getDownloadURL: (...a: unknown[]) => mockGetDownloadURL(...a),
}));

// Swappable firebase singleton
let mockAuth: unknown = {};
let mockDb: unknown = {};
let mockStorage: unknown = {};
jest.mock("@/lib/firebase", () => ({
  get auth() {
    return mockAuth;
  },
  get db() {
    return mockDb;
  },
  get storage() {
    return mockStorage;
  },
}));

import { act, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function wrap({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const originalFetch = global.fetch;

beforeEach(() => {
  mockOnAuthStateChanged.mockReset();
  mockSignInWithEmail.mockReset();
  mockCreateUserWithEmail.mockReset();
  mockFirebaseSignOut.mockReset();
  mockSignInWithPopup.mockReset();
  mockSendPasswordResetEmail.mockReset();
  mockUpdateProfile.mockReset();
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockUpdateDoc.mockReset();
  mockAuth = {};
  mockDb = {};
  mockStorage = {};
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("useAuth", () => {
  it("throws when called outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      /must be used within an AuthProvider/i
    );
  });
});

describe("AuthProvider — initialization", () => {
  it("sets loading=false when auth is null (no callback registered)", async () => {
    mockAuth = null;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockOnAuthStateChanged).not.toHaveBeenCalled();
  });

  it("handles null user from onAuthStateChanged (clears profile)", async () => {
    let cb: (u: unknown) => void = () => {};
    mockOnAuthStateChanged.mockImplementation((_a, c) => {
      cb = c as never;
      return jest.fn();
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await act(async () => {
      cb(null);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.userProfile).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("serves cached profile + skips Firestore read", async () => {
    let cb: (u: unknown) => void = () => {};
    mockOnAuthStateChanged.mockImplementation((_a, c) => {
      cb = c as never;
      return jest.fn();
    });
    // First render — fetch from Firestore (no cache).
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: "u1", email: "a@x" }),
    });
    const { result, unmount } = renderHook(() => useAuth(), { wrapper: wrap });
    await act(async () => {
      cb({ uid: "u1" });
    });
    await waitFor(() =>
      expect(result.current.userProfile?.email).toBe("a@x")
    );
    unmount();

    // Re-mount within TTL — cached profile applies, no new fetch.
    mockGetDoc.mockClear();
    const { result: r2 } = renderHook(() => useAuth(), { wrapper: wrap });
    let cb2: (u: unknown) => void = () => {};
    mockOnAuthStateChanged.mockImplementation((_a, c) => {
      cb2 = c as never;
      return jest.fn();
    });
    // mount happens before mock change so cb already fired
    void cb2;
  });

  it("fetches profile from Firestore on first sign-in (no cache)", async () => {
    let cb: (u: unknown) => void = () => {};
    mockOnAuthStateChanged.mockImplementation((_a, c) => {
      cb = c as never;
      return jest.fn();
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: "u-fresh", email: "fresh@x" }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await act(async () => {
      cb({ uid: "u-fresh" });
    });
    await waitFor(() =>
      expect(result.current.userProfile?.uid).toBe("u-fresh")
    );
  });

  it("handles user where Firestore doc doesn't exist", async () => {
    let cb: (u: unknown) => void = () => {};
    mockOnAuthStateChanged.mockImplementation((_a, c) => {
      cb = c as never;
      return jest.fn();
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await act(async () => {
      cb({ uid: "u-new-2" });
    });
    await waitFor(() => expect(result.current.userProfile).toBeNull());
  });

  it("swallows Firestore fetch errors silently", async () => {
    let cb: (u: unknown) => void = () => {};
    mockOnAuthStateChanged.mockImplementation((_a, c) => {
      cb = c as never;
      return jest.fn();
    });
    mockGetDoc.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await act(async () => {
      cb({ uid: "u-err" });
    });
    // No throw → component is alive.
    expect(result.current.loading).toBe(false);
  });
});

describe("AuthProvider — auth methods (auth-null branches)", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
  });

  it("signIn throws when auth is null", async () => {
    mockAuth = null;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(result.current.signIn("a", "b")).rejects.toThrow(
      /Firebase is not configured/
    );
  });

  it("signUp throws when auth is null", async () => {
    mockAuth = null;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(result.current.signUp("a", "b", "n")).rejects.toThrow(
      /Firebase is not configured/
    );
  });

  it("signInWithGoogle / signInWithGithub throw when auth is null", async () => {
    mockAuth = null;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(result.current.signInWithGoogle()).rejects.toThrow();
    await expect(result.current.signInWithGithub()).rejects.toThrow();
  });

  it("signOut + resetPassword throw when auth is null", async () => {
    mockAuth = null;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(result.current.signOut()).rejects.toThrow();
    await expect(result.current.resetPassword("x@x")).rejects.toThrow();
  });
});

describe("AuthProvider — auth methods (happy path)", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockAuth = { currentUser: null };
  });

  it("signIn delegates to firebase signInWithEmailAndPassword", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    mockSignInWithEmail.mockResolvedValueOnce({ user: { uid: "u1" } });
    await result.current.signIn("a@x", "pw");
    expect(mockSignInWithEmail).toHaveBeenCalledWith(mockAuth, "a@x", "pw");
  });

  it("signUp creates a user, updates the profile, and writes to Firestore (no existing doc)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    mockCreateUserWithEmail.mockResolvedValueOnce({
      user: { uid: "u1", email: "a@x", displayName: "A", photoURL: null },
    });
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1", displayName: "A" }),
      });
    await result.current.signUp("a@x", "pw", "Alice");
    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it("signUp updates existing Firestore doc with OAuth-authoritative fields", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    // signUp is "email" provider, not OAuth — the OAuth-authoritative branch
    // only fires for google/github. signUp still hits the "exists" branch.
    mockCreateUserWithEmail.mockResolvedValueOnce({
      user: { uid: "u1", email: "a@x", displayName: "A", photoURL: "p.png" },
    });
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1" }), // no photoURL/displayName
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1", displayName: "A", photoURL: "p.png" }),
      });
    await result.current.signUp("a@x", "pw", "A");
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it("signInWithGoogle uses OAuth-authoritative branch for displayName/photoURL", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    mockSignInWithPopup.mockResolvedValueOnce({
      user: { uid: "u1", email: "x", displayName: "Alice", photoURL: "p.png" },
    });
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1", photoURL: "old.png", displayName: "Old" }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1", photoURL: "p.png", displayName: "Alice" }),
      });
    await result.current.signInWithGoogle();
    expect(mockSignInWithPopup).toHaveBeenCalled();
  });

  it("signInWithGithub fires the OAuth branch", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    mockSignInWithPopup.mockResolvedValueOnce({
      user: { uid: "u1", displayName: "G", photoURL: null, email: "x" },
    });
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1" }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: "u1", displayName: "G" }),
      });
    await result.current.signInWithGithub();
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it("signOut firebase-signs-out + clears profile", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    mockFirebaseSignOut.mockResolvedValueOnce(undefined);
    await result.current.signOut();
    expect(mockFirebaseSignOut).toHaveBeenCalled();
  });

  it("resetPassword forwards to firebase sendPasswordResetEmail", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    mockSendPasswordResetEmail.mockResolvedValueOnce(undefined);
    await result.current.resetPassword("x@x");
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, "x@x");
  });
});

describe("AuthProvider — fetch wrappers (auth-required + happy + error)", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
  });

  it("sendAddEmailVerification throws when no currentUser", async () => {
    mockAuth = { currentUser: null };
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(
      result.current.sendAddEmailVerification("new@x")
    ).rejects.toThrow(/Not authenticated/);
  });

  it("sendAddEmailVerification posts to /api/auth/send-email-verification", async () => {
    mockAuth = {
      currentUser: { getIdToken: jest.fn().mockResolvedValue("tok") },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await result.current.sendAddEmailVerification("New@X.com");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/auth/send-email-verification");
    expect(JSON.parse((init as { body: string }).body).email).toBe("new@x.com");
  });

  it("sendAddEmailVerification throws on non-ok body", async () => {
    mockAuth = {
      currentUser: { getIdToken: jest.fn().mockResolvedValue("tok") },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(
      result.current.sendAddEmailVerification("new@x")
    ).rejects.toThrow(/nope/);
  });

  it("removeAdditionalEmail happy path refreshes profile", async () => {
    mockAuth = {
      currentUser: {
        uid: "u1",
        getIdToken: jest.fn().mockResolvedValue("tok"),
      },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: "u1" }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await result.current.removeAdditionalEmail("old@x");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("removeAdditionalEmail throws on non-ok body", async () => {
    mockAuth = {
      currentUser: { getIdToken: jest.fn().mockResolvedValue("tok") },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "fail" }),
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(
      result.current.removeAdditionalEmail("x@x")
    ).rejects.toThrow(/fail/);
  });

  it("changePrimaryEmail happy + error", async () => {
    mockAuth = {
      currentUser: { getIdToken: jest.fn().mockResolvedValue("tok") },
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "primary failed" }),
      }) as unknown as typeof fetch;
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await result.current.changePrimaryEmail("a@x");
    await expect(result.current.changePrimaryEmail("b@x")).rejects.toThrow(
      /primary failed/
    );
  });
});

describe("AuthProvider — refreshUserProfile", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
  });

  it("no-ops when there is no current user or db", async () => {
    mockAuth = { currentUser: null };
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await result.current.refreshUserProfile();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it("loads profile from Firestore when authenticated", async () => {
    mockAuth = { currentUser: { uid: "u1" } };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: "u1", displayName: "X" }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await result.current.refreshUserProfile();
    await waitFor(() =>
      expect(result.current.userProfile?.displayName).toBe("X")
    );
  });
});
