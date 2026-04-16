/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CERTIFICATE_PR_THRESHOLD } from "@/lib/certificate";
import type { ProfileDataApiResponse } from "@/lib/profile-data-types";
import type { Certificate, CertificateClaimResponse } from "@/types/certificate";
import { CertificateCard } from "./_components/CertificateCard";
import { CertificateProgress } from "./_components/CertificateProgress";

export default function CertificatePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [pullRequestsCount, setPullRequestsCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/certificate");
    }
  }, [loading, user, router]);

  // Fetch PR count and check for existing certificate
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${await user.getIdToken()}` };

        // Fetch profile data (includes PR count)
        const res = await fetch("/api/profile/data", { headers });
        if (!res.ok) throw new Error(`Profile data failed: ${res.status}`);
        const json = (await res.json()) as ProfileDataApiResponse;

        let prCount = json.stats.pullRequestsCount ?? 0;

        // If GitHub connected but 0 PRs, try reconciliation
        const githubLogin =
          userProfile?.github &&
          typeof userProfile.github === "object" &&
          "login" in userProfile.github &&
          typeof (userProfile.github as { login?: string }).login === "string"
            ? (userProfile.github as { login: string }).login.trim()
            : "";

        if (githubLogin && prCount === 0) {
          const res2 = await fetch("/api/profile/data?reconcileGithub=1", {
            headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          });
          if (res2.ok) {
            const json2 = (await res2.json()) as ProfileDataApiResponse;
            prCount = json2.stats.pullRequestsCount ?? 0;
          }
        }

        setPullRequestsCount(prCount);

        // Try to claim to check if already claimed (idempotent endpoint)
        if (prCount >= CERTIFICATE_PR_THRESHOLD) {
          const claimRes = await fetch("/api/certificate/claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
          });
          if (claimRes.ok) {
            const claimData = (await claimRes.json()) as CertificateClaimResponse;
            setCertificate(claimData.certificate);
            setLinkedInUrl(claimData.linkedInAddToProfileUrl);
          }
        }
      } catch (err) {
        console.error("Error loading certificate data:", err);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user, userProfile]);

  const handleClaim = async () => {
    if (!user) return;
    setClaiming(true);
    setError(null);

    try {
      const res = await fetch("/api/certificate/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to claim certificate");
        return;
      }

      const data = (await res.json()) as CertificateClaimResponse;
      setCertificate(data.certificate);
      setLinkedInUrl(data.linkedInAddToProfileUrl);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white" />
      </div>
    );
  }

  const isEligible = pullRequestsCount >= CERTIFICATE_PR_THRESHOLD;

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-2xl mx-auto">
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            LinkedIn Certificate
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Earn your Cursor Boston Open Source Contributor certificate by merging{" "}
            {CERTIFICATE_PR_THRESHOLD} pull requests, then add it to your LinkedIn profile.
          </p>
        </section>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white" />
          </div>
        ) : certificate && linkedInUrl ? (
          <CertificateCard certificate={certificate} linkedInAddToProfileUrl={linkedInUrl} />
        ) : isEligible ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-neutral-900 p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <Award className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              You&apos;re eligible!
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              You have {pullRequestsCount} merged PRs. Claim your certificate to add it to
              your LinkedIn profile.
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            )}
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {claiming ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Claiming...
                </>
              ) : (
                <>
                  <Award className="h-4 w-4" />
                  Claim Your Certificate
                </>
              )}
            </button>
          </div>
        ) : (
          <CertificateProgress pullRequestsCount={pullRequestsCount} />
        )}
      </div>
    </div>
  );
}
