/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Certificate } from "@/types/certificate";

export const CERTIFICATES_COLLECTION = "certificates";
export const CERTIFICATE_PR_THRESHOLD = 10;
export const CERTIFICATE_NAME = "Cursor Boston Open Source Contributor";
export const LINKEDIN_ORGANIZATION_ID = "112955918";

function getSiteOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com";
}

export function getCertificateDocId(userId: string): string {
  return `cert_${userId}`;
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

  if (
    !data.userId ||
    !data.displayName ||
    !data.githubLogin ||
    !issuedAt ||
    typeof data.pullRequestsCount !== "number"
  ) {
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
  };
}
