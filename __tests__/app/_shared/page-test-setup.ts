/**
 * Shared jest mocks for app page RTL tests. Import at top of each page test file:
 *   import "@/__tests__/app/_shared/page-test-setup";
 */

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
  storage: null,
  rtdb: null,
  app: null,
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_, cb) => {
    cb(null);
    return jest.fn();
  }),
  getIdToken: jest.fn((user) => user?.getIdToken?.() ?? Promise.resolve("test-token")),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: class {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  addDoc: jest.fn().mockResolvedValue({ id: "new-doc" }),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
  getDocs: jest.fn().mockResolvedValue({ docs: [], empty: true }),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: () => "__ts",
  Timestamp: {
    fromMillis: (ms: number) => ({ toDate: () => new Date(ms) }),
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({ tileId: "1_0", heroId: "hero-1" }),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => require("react").createElement("a", { href }, children),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: null,
    userProfile: null,
    loading: false,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components/SectionHelp", () => ({
  SectionHelp: () => null,
}));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: () => null,
}));
