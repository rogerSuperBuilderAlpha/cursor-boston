/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export interface Certificate {
  id: string;
  userId: string;
  displayName: string;
  githubLogin: string;
  pullRequestsCount: number;
  issuedAt: string;
  certName: string;
  certUrl: string;
}

export interface CertificateClaimResponse {
  certificate: Certificate;
  linkedInAddToProfileUrl: string;
}

export interface CertificateClaimErrorResponse {
  error: string;
  eligible?: false;
  pullRequestsCount?: number;
  required?: number;
}
