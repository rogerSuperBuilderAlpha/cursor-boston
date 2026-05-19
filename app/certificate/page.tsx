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
import type {
  CertificateClaimResponse,
  CertificateEntry,
  CertificateListResponse,
} from "@/types/certificate";
import { CertificateCard } from "./_components/CertificateCard";
import { CertificateProgress } from "./_components/CertificateProgress";
import { SectionHelp } from "@/components/SectionHelp";

export default function CertificatePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [pullRequestsCount, setPullRequestsCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<CertificateEntry[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/certificate");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoadError(null);

      try {
        const headers = { Authorization: `Bearer ${await user.getIdToken()}` };

        const mineRes = await fetch("/api/certificate/mine", { headers });
        let issued: CertificateEntry[] = [];
        if (mineRes.ok) {
          const mine = (await mineRes.json()) as CertificateListResponse;
          issued = mine.certificates ?? [];
        } else {
          setLoadError(
            "We couldn't load your issued certificates. Try refreshing, or use the verification link from your winner email."
          );
        }

        let prCount = 0;
        try {
          const profileRes = await fetch("/api/profile/data", { headers });
          if (profileRes.ok) {
            const json = (await profileRes.json()) as ProfileDataApiResponse;
            prCount = json.stats.pullRequestsCount ?? 0;

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
          }
        } catch (profileErr) {
          console.error("Error loading profile PR count:", profileErr);
        }

        setPullRequestsCount(prCount);

        const hasContributorCert = issued.some(
          (entry) => entry.certificate.kind === "contributor"
        );

        if (prCount >= CERTIFICATE_PR_THRESHOLD && !hasContributorCert) {
          const claimRes = await fetch("/api/certificate/claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
          });
          if (claimRes.ok) {
            const claimData = (await claimRes.json()) as CertificateClaimResponse;
            issued = [
              ...issued,
              {
                certificate: claimData.certificate,
                linkedInAddToProfileUrl: claimData.linkedInAddToProfileUrl,
              },
            ];
          }
        }

        setCertificates(issued);
      } catch (err) {
        console.error("Error loading certificate data:", err);
        setLoadError("Something went wrong loading your certificates. Please refresh.");
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
      setCertificates((prev) => {
        const withoutContributor = prev.filter(
          (entry) => entry.certificate.kind !== "contributor"
        );
        return [
          ...withoutContributor,
          {
            certificate: data.certificate,
            linkedInAddToProfileUrl: data.linkedInAddToProfileUrl,
          },
        ];
      });
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
  const hasContributorCert = certificates.some(
    (entry) => entry.certificate.kind === "contributor"
  );
  const cohortWinnerCerts = certificates.filter(
    (entry) => entry.certificate.kind === "cohort-winner"
  );
  const contributorCert = certificates.find(
    (entry) => entry.certificate.kind === "contributor"
  );
  const hasCohortWinnerCert = cohortWinnerCerts.length > 0;

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-2xl mx-auto">
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            LinkedIn Certificates
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl">
            {hasCohortWinnerCert
              ? "Your cohort awards are ready to add to LinkedIn. The contributor certificate below is a separate optional track."
              : "View certificates you've earned — Summer Cohort weekly wins and the Open Source Contributor award after 10 merged pull requests."}
          </p>
        </section>

        {loadError ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {loadError}
          </p>
        ) : null}

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white" />
          </div>
        ) : (
          <div className="space-y-10">
            {certificates.length > 0 ? (
              <section className="space-y-6">
                <h2 className="text-lg font-semibold text-foreground">
                  Your certificates
                </h2>
                {cohortWinnerCerts.map((entry) => (
                  <CertificateCard
                    key={entry.certificate.id}
                    certificate={entry.certificate}
                    linkedInAddToProfileUrl={entry.linkedInAddToProfileUrl}
                  />
                ))}
                {contributorCert ? (
                  <CertificateCard
                    certificate={contributorCert.certificate}
                    linkedInAddToProfileUrl={contributorCert.linkedInAddToProfileUrl}
                  />
                ) : null}
              </section>
            ) : null}

            {!hasContributorCert ? (
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Open Source Contributor
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Merge {CERTIFICATE_PR_THRESHOLD} pull requests into this repo to
                    claim a LinkedIn-ready contributor certificate.
                  </p>
                </div>

                {!hasCohortWinnerCert ? (
                  <SectionHelp
                    title="About the contributor certificate"
                    intro={
                      <>
                        After {CERTIFICATE_PR_THRESHOLD} merged PRs against this repo,
                        you can claim a LinkedIn-compatible Cursor Boston Open Source
                        Contributor certificate. The merge count is auto-detected from
                        your linked GitHub account.
                      </>
                    }
                    faq={[
                      {
                        q: "Which PRs count?",
                        a: "Any merged PR into this repo that has your linked GitHub login as the author. Closed/unmerged PRs don't count.",
                      },
                      {
                        q: "Why isn't my count updating?",
                        a: "Make sure your GitHub account is linked from your profile. The page will trigger a reconciliation; if it stays at 0, check that the GitHub username on your profile is correct.",
                      },
                      {
                        q: "Can I add it to LinkedIn?",
                        a: "Yes — after claiming, the Add-to-Profile button generates a one-click LinkedIn link with the certificate details prefilled.",
                      },
                      {
                        q: "What about cohort winner certificates?",
                        a: "If you win a Summer Cohort weekly vote, your certificate appears automatically at the top of this page once it is issued.",
                      },
                    ]}
                    links={[
                      { label: "Your profile / link GitHub", href: "/profile" },
                      { label: "First contribution guide", href: "/open-source" },
                      { label: "Summer Cohort", href: "/summer-cohort" },
                    ]}
                  />
                ) : null}

                {isEligible ? (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-neutral-900 p-6 text-center">
                    <div className="flex justify-center mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                        <Award className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      Contributor certificate unlocked
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                      You have {pullRequestsCount} merged PRs. Claim your contributor
                      certificate to add it to LinkedIn too.
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
                          Claim Contributor Certificate
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <CertificateProgress
                    pullRequestsCount={pullRequestsCount}
                    compact={hasCohortWinnerCert}
                  />
                )}
              </section>
            ) : (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Your Open Source Contributor certificate is listed above.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
