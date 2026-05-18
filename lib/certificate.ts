/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { Certificate, CertificateKind } from "@/types/certificate";
import type { SummerCohortId } from "@/lib/summer-cohort";

export const CERTIFICATES_COLLECTION = "certificates";
export const CERTIFICATE_PR_THRESHOLD = 10;
export const CERTIFICATE_NAME = "Cursor Boston Open Source Contributor";
export const LINKEDIN_ORGANIZATION_ID = "112955918";

/** LinkedIn certification titles for cohort weekly vote winners. */
export const COHORT_WINNER_CERT_NAMES: Partial<
  Record<SummerCohortId, Partial<Record<string, string>>>
> = {
  "cohort-1": {
    "week-1": "Cohort 1 Week 1 Best Project Management Tool",
    "week-2": "Cohort 1 Week 2 Best Communications Platform",
    "week-3": "Cohort 1 Week 3 Best Marketing Platform",
  },
  "cohort-2": {
    "week-1": "Cohort 2 Week 1 Best Project Management Tool",
    "week-2": "Cohort 2 Week 2 Best Communications Platform",
    "week-3": "Cohort 2 Week 3 Best Marketing Platform",
  },
};

function getSiteOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com";
}

export function getCertificateDocId(userId: string): string {
  return `cert_${userId}`;
}

export function getCohortWinnerCertDocId(
  cohortId: SummerCohortId,
  weekId: string,
  userId: string
): string {
  return `cert_${cohortId}_${weekId}_${userId}`;
}

export function getCohortWinnerCertName(
  cohortId: SummerCohortId,
  weekId: string
): string | null {
  return COHORT_WINNER_CERT_NAMES[cohortId]?.[weekId] ?? null;
}

function readCertificateKind(data: Record<string, unknown>): CertificateKind {
  return data.kind === "cohort-winner" ? "cohort-winner" : "contributor";
}

export function getCertVerifyUrl(certId: string): string {
  return `${getSiteOrigin()}/certificate/verify/${certId}`;
}

export function buildLinkedInAddToProfileUrl(cert: Certificate): string {
  const issuedDate = new Date(cert.issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.certName,
    organizationId: LINKEDIN_ORGANIZATION_ID,
    issueYear: String(issuedDate.getFullYear()),
    issueMonth: String(issuedDate.getMonth() + 1),
    certUrl: cert.certUrl,
    certId: cert.id,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function parseCertificateFromFirestore(
  docId: string,
  data: Record<string, unknown>
): Certificate | null {
  const rawIssuedAt = data.issuedAt as
    | string
    | { toDate?: () => Date; seconds?: number }
    | undefined;

  let issuedAt: string | null = null;
  if (typeof rawIssuedAt === "string") {
    issuedAt = rawIssuedAt;
  } else if (rawIssuedAt && typeof rawIssuedAt.toDate === "function") {
    issuedAt = rawIssuedAt.toDate().toISOString();
  } else if (rawIssuedAt && typeof rawIssuedAt.seconds === "number") {
    issuedAt = new Date(rawIssuedAt.seconds * 1000).toISOString();
  }

  if (!data.userId || !data.displayName || !data.githubLogin || !issuedAt) {
    return null;
  }

  const kind = readCertificateKind(data);

  if (kind === "contributor") {
    if (typeof data.pullRequestsCount !== "number") {
      return null;
    }
    return {
      id: (data.id as string) || docId,
      userId: data.userId as string,
      displayName: data.displayName as string,
      githubLogin: data.githubLogin as string,
      pullRequestsCount: data.pullRequestsCount as number,
      issuedAt,
      certName: (data.certName as string) || CERTIFICATE_NAME,
      certUrl: (data.certUrl as string) || getCertVerifyUrl(docId),
      kind,
    };
  }

  const cohortId =
    typeof data.cohortId === "string" ? data.cohortId : undefined;
  const weekId = typeof data.weekId === "string" ? data.weekId : undefined;
  if (!cohortId || !weekId) {
    return null;
  }

  return {
    id: (data.id as string) || docId,
    userId: data.userId as string,
    displayName: data.displayName as string,
    githubLogin: data.githubLogin as string,
    issuedAt,
    certName: (data.certName as string) || getCohortWinnerCertName(cohortId as SummerCohortId, weekId) || "Cohort Winner",
    certUrl: (data.certUrl as string) || getCertVerifyUrl(docId),
    kind,
    cohortId,
    weekId,
    voteCount: typeof data.voteCount === "number" ? data.voteCount : undefined,
  };
}

/** All LinkedIn certificates issued to a user (contributor + cohort winners). */
export async function listCertificatesForUser(
  db: Firestore,
  userId: string
): Promise<Certificate[]> {
  const snap = await db
    .collection(CERTIFICATES_COLLECTION)
    .where("userId", "==", userId)
    .get();

  const certificates: Certificate[] = [];
  for (const doc of snap.docs) {
    const parsed = parseCertificateFromFirestore(
      doc.id,
      doc.data() as Record<string, unknown>
    );
    if (parsed) {
      certificates.push(parsed);
    }
  }

  return certificates.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "cohort-winner" ? -1 : 1;
    }
    return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
  });
}
