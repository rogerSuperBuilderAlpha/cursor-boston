/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage — `app/certificate/verify/[certId]/page.tsx`
 * (0% / 38 uncovered branches). Tests the server-rendered page +
 * generateMetadata for: db-null no-op, not-found path, OSS-contributor
 * (default) render branch, cohort-winner render branch, voteCount /
 * pullRequestsCount fallbacks, and cohort metadata block.
 */

const mockGetAdminDb = jest.fn();
const mockNotFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

jest.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    cache: (fn: unknown) => fn,
  };
});

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

const mockDocGet = jest.fn();
function setDb(certData: Record<string, unknown> | null) {
  mockGetAdminDb.mockReturnValue({
    collection: () => ({
      doc: () => ({
        get: () => {
          mockDocGet(certData);
          return Promise.resolve({
            exists: certData !== null,
            data: () => certData,
          });
        },
      }),
    }),
  });
}

jest.mock("@/lib/certificate", () => ({
  CERTIFICATES_COLLECTION: "certificates",
  parseCertificateFromFirestore: (id: string, data: Record<string, unknown>) => ({
    id,
    displayName: (data.displayName as string) ?? "Anon",
    githubLogin: (data.githubLogin as string) ?? "anon",
    certName: (data.certName as string) ?? "Contributor",
    pullRequestsCount: data.pullRequestsCount as number | undefined,
    voteCount: data.voteCount as number | undefined,
    issuedAt: (data.issuedAt as string) ?? "2026-05-01T00:00:00Z",
    kind: data.kind as string | undefined,
    cohortId: data.cohortId as string | undefined,
    weekId: data.weekId as string | undefined,
  }),
}));

import CertificateVerifyPage, {
  generateMetadata,
} from "@/app/certificate/verify/[certId]/page";

function params(certId: string) {
  return Promise.resolve({ certId });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CertificateVerifyPage", () => {
  it("calls notFound when admin db is unavailable", async () => {
    mockGetAdminDb.mockReturnValue(null);
    await expect(CertificateVerifyPage({ params: params("c1") })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when certificate doc does not exist", async () => {
    setDb(null);
    await expect(CertificateVerifyPage({ params: params("missing") })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("renders the OSS-contributor branch (default kind, pullRequestsCount)", async () => {
    setDb({
      displayName: "Ada Lovelace",
      githubLogin: "ada",
      certName: "Top Contributor",
      pullRequestsCount: 42,
      issuedAt: "2026-05-19T00:00:00Z",
    });
    const result = (await CertificateVerifyPage({ params: params("c1") })) as React.ReactElement;
    const json = JSON.stringify(result);
    expect(json).toContain("Ada Lovelace");
    expect(json).toContain("ada");
    expect(json).toContain("Top Contributor");
    expect(json).toContain("42 merged PRs");
    // Cohort-block strings should NOT appear
    expect(json).not.toContain("Cohort");
  });

  it("renders the cohort-winner branch with vote count", async () => {
    setDb({
      displayName: "Bobby",
      githubLogin: "bob",
      certName: "Week 3 Winner",
      voteCount: 7,
      kind: "cohort-winner",
      cohortId: "c1",
      weekId: "w3",
    });
    const result = (await CertificateVerifyPage({ params: params("c2") })) as React.ReactElement;
    const json = JSON.stringify(result);
    expect(json).toContain("7 cohort votes");
    expect(json).toContain("c1");
    expect(json).toContain("w3");
  });

  it("falls back to 0 when pullRequestsCount is undefined", async () => {
    setDb({
      displayName: "Eve",
      githubLogin: "eve",
      certName: "Contributor",
    });
    const result = (await CertificateVerifyPage({ params: params("c3") })) as React.ReactElement;
    expect(JSON.stringify(result)).toContain("0 merged PRs");
  });

  it("falls back to 0 when voteCount is undefined on cohort-winner", async () => {
    setDb({
      displayName: "Eve",
      githubLogin: "eve",
      certName: "Cohort Win",
      kind: "cohort-winner",
    });
    const result = (await CertificateVerifyPage({ params: params("c3") })) as React.ReactElement;
    expect(JSON.stringify(result)).toContain("0 cohort votes");
  });
});

describe("CertificateVerifyPage generateMetadata", () => {
  it("returns 'Certificate Not Found' title when no certificate", async () => {
    setDb(null);
    const meta = await generateMetadata({ params: params("missing") });
    expect(meta.title).toMatch(/Not Found/);
  });

  it("returns OSS-contributor metadata", async () => {
    setDb({
      displayName: "Ada",
      githubLogin: "ada",
      certName: "Open Source Contributor",
      pullRequestsCount: 3,
    });
    const meta = await generateMetadata({ params: params("c1") });
    expect(meta.title).toContain("Ada");
    expect(meta.title).toContain("Open Source Contributor");
    expect((meta.description as string) ?? "").toMatch(/3 merged pull requests/);
  });

  it("returns cohort-winner metadata", async () => {
    setDb({
      displayName: "Bob",
      githubLogin: "bob",
      certName: "Week 1 Winner",
      voteCount: 5,
      kind: "cohort-winner",
    });
    const meta = await generateMetadata({ params: params("c2") });
    expect(meta.title).toContain("Bob");
    expect((meta.description as string) ?? "").toMatch(/5 cohort votes/);
  });

  it("falls back to 0 in metadata description when counts are missing", async () => {
    setDb({
      displayName: "Eve",
      githubLogin: "eve",
      certName: "Cert",
    });
    const meta = await generateMetadata({ params: params("c3") });
    expect((meta.description as string) ?? "").toMatch(/0 merged pull requests/);
  });
});
