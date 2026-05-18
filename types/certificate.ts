/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export type CertificateKind = "contributor" | "cohort-winner";

export interface Certificate {
  id: string;
  userId: string;
  displayName: string;
  githubLogin: string;
  issuedAt: string;
  certName: string;
  certUrl: string;
  kind: CertificateKind;
  /** Present on contributor certificates (merged-PR threshold). */
  pullRequestsCount?: number;
  /** Present on cohort weekly winner certificates. */
  cohortId?: string;
  weekId?: string;
  voteCount?: number;
}

export interface CertificateClaimResponse {
  certificate: Certificate;
  linkedInAddToProfileUrl: string;
}

export interface CertificateEntry {
  certificate: Certificate;
  linkedInAddToProfileUrl: string;
}

export interface CertificateListResponse {
  certificates: CertificateEntry[];
}

export interface CertificateClaimErrorResponse {
  error: string;
  eligible?: false;
  pullRequestsCount?: number;
  required?: number;
}
