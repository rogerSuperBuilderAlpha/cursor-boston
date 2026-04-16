/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, CheckCircle } from "lucide-react";
import { GitHubIcon } from "@/components/icons";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  CERTIFICATES_COLLECTION,
  parseCertificateFromFirestore,
} from "@/lib/certificate";

interface Props {
  params: Promise<{ certId: string }>;
}

async function getCertificate(certId: string) {
  const db = getAdminDb();
  if (!db) return null;

  const doc = await db.collection(CERTIFICATES_COLLECTION).doc(certId).get();
  if (!doc.exists) return null;

  return parseCertificateFromFirestore(certId, doc.data() as Record<string, unknown>);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certId } = await params;
  const cert = await getCertificate(certId);

  if (!cert) {
    return { title: "Certificate Not Found | Cursor Boston" };
  }

  return {
    title: `${cert.displayName} - ${cert.certName} | Cursor Boston`,
    description: `${cert.displayName} (@${cert.githubLogin}) earned the ${cert.certName} certificate with ${cert.pullRequestsCount} merged pull requests.`,
    openGraph: {
      title: `${cert.displayName} - ${cert.certName}`,
      description: `Verified open source contributor with ${cert.pullRequestsCount} merged PRs to Cursor Boston.`,
      type: "profile",
    },
  };
}

export default async function CertificateVerifyPage({ params }: Props) {
  const { certId } = await params;
  const cert = await getCertificate(certId);

  if (!cert) {
    notFound();
  }

  const issuedDate = new Date(cert.issuedAt);
  const formattedDate = issuedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-2xl mx-auto">
        {/* Verified badge */}
        <div className="flex items-center gap-2 mb-6">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Verified Certificate
          </span>
        </div>

        {/* Certificate display */}
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-white dark:bg-neutral-900 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent" />
          <div className="relative">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <Award className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
              Certificate of Achievement
            </p>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {cert.certName}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Awarded to
            </p>
            <p className="text-xl font-semibold text-foreground mb-1">
              {cert.displayName}
            </p>
            <a
              href={`https://github.com/${cert.githubLogin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400 hover:text-foreground transition-colors mb-4"
            >
              <GitHubIcon size={14} />
              @{cert.githubLogin}
            </a>
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-sm">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  {cert.pullRequestsCount} merged PRs
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
              Issued {formattedDate}
            </p>
          </div>
        </div>

        {/* Verification details */}
        <div className="mt-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h2 className="text-sm font-medium text-foreground mb-3">Verification Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500 dark:text-neutral-400">Certificate ID</dt>
              <dd className="font-mono text-foreground">{cert.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500 dark:text-neutral-400">Issued By</dt>
              <dd className="text-foreground">Cursor Boston</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500 dark:text-neutral-400">Issue Date</dt>
              <dd className="text-foreground">{formattedDate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500 dark:text-neutral-400">Merged PRs at Issuance</dt>
              <dd className="text-foreground">{cert.pullRequestsCount}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
          This certificate was issued by{" "}
          <a
            href="https://cursorboston.com"
            className="hover:underline"
          >
            Cursor Boston
          </a>{" "}
          for open source contributions to the{" "}
          <a
            href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            cursor-boston
          </a>{" "}
          repository.
        </p>
      </div>
    </div>
  );
}
