/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Award, ExternalLink } from "lucide-react";
import { LinkedInIcon } from "@/components/icons";
import type { Certificate } from "@/types/certificate";

interface CertificateCardProps {
  certificate: Certificate;
  linkedInAddToProfileUrl: string;
}

export function CertificateCard({ certificate, linkedInAddToProfileUrl }: CertificateCardProps) {
  const issuedDate = new Date(certificate.issuedAt);
  const formattedDate = issuedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Certificate visual */}
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
          <h2 className="text-2xl font-bold text-foreground mb-1">
            {certificate.certName}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Awarded to
          </p>
          <p className="text-xl font-semibold text-foreground mb-1">
            {certificate.displayName}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            @{certificate.githubLogin}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-sm">
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">
              {certificate.pullRequestsCount} merged PRs
            </span>
          </div>
          <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
            Issued {formattedDate}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={linkedInAddToProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-3 text-sm font-medium text-white hover:bg-[#004182] transition-colors"
        >
          <LinkedInIcon size={16} />
          Add to LinkedIn Profile
        </a>
        <a
          href={certificate.certUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View Verification Page
        </a>
      </div>
    </div>
  );
}
