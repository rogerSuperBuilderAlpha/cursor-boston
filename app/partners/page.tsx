/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  HIRING_PARTNERS_CALENDLY_URL,
  HIRING_PARTNERS_MAX,
  HIRING_PARTNERS_RETURN_TO,
  PARTNER_ENGINEER_EXPECTATION_ITEMS,
  type HiringPartnerStatus,
  type PartnerEngineerExpectationKey,
} from "@/lib/hiring-partners";

interface PartnerApplicationDto {
  userId: string | null;
  email: string | null;
  contactName: string | null;
  phone: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  contactRole: string | null;
  rolesHiring: string | null;
  notes: string | null;
  engineerExpectations: Partial<Record<PartnerEngineerExpectationKey, number>>;
  engineerRequirements: string | null;
  status: HiringPartnerStatus;
  createdAt: number | null;
  updatedAt: number | null;
}

function CalendlyCard({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
      <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
        {heading}
      </h2>
      <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">
        {body}
      </p>
      <a
        href={HIRING_PARTNERS_CALENDLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
      >
        Book a call with Roger
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
      </a>
    </section>
  );
}

function StatusPanel({ application }: { application: PartnerApplicationDto }) {
  const tone =
    application.status === "approved"
      ? {
          panel:
            "rounded-xl border border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-700 dark:bg-emerald-950/40",
          badge: "bg-emerald-500 text-white",
          label: "Status: Approved",
          headline: "You're an approved Cursor Boston hiring partner.",
          body:
            "Welcome aboard. Use the Calendly link below to set up a call whenever you'd like to talk through candidates, roles, or events.",
        }
      : application.status === "rejected"
        ? {
            panel:
              "rounded-xl border border-neutral-300 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-900/60",
            badge: "bg-neutral-500 text-white",
            label: "Status: Not approved",
            headline: "We weren't able to move forward right now.",
            body:
              "Thanks for the interest — feel free to reach out directly if anything changes on your end.",
          }
        : {
            panel:
              "rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30",
            badge: "bg-amber-500 text-white",
            label: "Status: Pending",
            headline: "We got your application.",
            body:
              "Next step is a quick call with Roger. Grab a slot below — and feel free to fill in the rest of your company info while you're here.",
          };

  return (
    <section className={tone.panel}>
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.badge}`}
      >
        {tone.label}
      </span>
      <p className="mt-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
        {tone.headline}
      </p>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {tone.body}
      </p>
    </section>
  );
}

export default function PartnersPage() {
  const { user, loading } = useAuth();

  const [application, setApplication] = useState<PartnerApplicationDto | null>(null);
  const [appLoading, setAppLoading] = useState(false);
  const [appLoadError, setAppLoadError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [rolesHiring, setRolesHiring] = useState("");
  const [notes, setNotes] = useState("");
  const [engineerExpectations, setEngineerExpectations] = useState<
    Partial<Record<PartnerEngineerExpectationKey, number>>
  >({});
  const [engineerRequirements, setEngineerRequirements] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user && !contactName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prefilling form once auth subject becomes available
      setContactName(user.displayName || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      setAppLoading(true);
      setAppLoadError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/hiring-partners/apply", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("load_failed");
        const json = (await res.json()) as { application: PartnerApplicationDto | null };
        if (cancelled) return;
        setApplication(json.application);
        if (json.application) {
          setContactName(json.application.contactName || user.displayName || "");
          setPhone(json.application.phone || "");
          setCompanyName(json.application.companyName || "");
          setCompanyWebsite(json.application.companyWebsite || "");
          setContactRole(json.application.contactRole || "");
          setRolesHiring(json.application.rolesHiring || "");
          setNotes(json.application.notes || "");
          setEngineerExpectations(json.application.engineerExpectations || {});
          setEngineerRequirements(json.application.engineerRequirements || "");
        }
      } catch {
        if (!cancelled) setAppLoadError("Couldn't load your application.");
      } finally {
        if (!cancelled) setAppLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!contactName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!phone.trim()) {
      setSubmitError("Please enter a phone number.");
      return;
    }

    const isUpdate = application !== null;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hiring-partners/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contactName: contactName.trim(),
          phone: phone.trim(),
          companyName: companyName.trim(),
          companyWebsite: companyWebsite.trim(),
          contactRole: contactRole.trim(),
          rolesHiring: rolesHiring.trim(),
          notes: notes.trim(),
          engineerExpectations,
          engineerRequirements: engineerRequirements.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(typeof json.error === "string" ? json.error : "Submit failed.");
        return;
      }
      setApplication(json.application as PartnerApplicationDto);
      setSubmitSuccess(isUpdate ? "Saved." : "Application received — see next steps below.");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Hiring Partners
        </p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">
          Hire from the Cursor Boston community
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Hiring partners get visibility into our cohorts, hackathons, and meetups, and a
          direct line to Boston builders shipping with Cursor.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
          Loading…
        </div>
      ) : !user ? (
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
          <h2 className="text-lg font-semibold">Sign in to get started</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            We need an account on file to follow up on your application.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(HIRING_PARTNERS_RETURN_TO)}`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            Sign in
          </Link>
        </section>
      ) : appLoading ? (
        <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
          Checking your application…
        </div>
      ) : appLoadError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {appLoadError}
        </div>
      ) : (
        <>
          {application ? (
            <>
              <StatusPanel application={application} />
              <CalendlyCard
                heading={
                  application.status === "approved"
                    ? "Set up a call whenever"
                    : "Book your intro call"
                }
                body={
                  application.status === "approved"
                    ? "Roger is your point of contact. Grab a slot whenever you want to talk through hiring or sponsorship."
                    : "This is the next step. Pick a time that works — Roger will go through how the partnership works on the call."
                }
              />
            </>
          ) : null}

          <section
            className={`${application ? "mt-6" : ""} rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900`}
          >
            <h2 className="text-lg font-semibold">
              {application ? "Your company profile" : "Get started"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {application
                ? "Fill in the rest whenever — we use this on our end to know what kinds of candidates and events to send your way."
                : "Just your name, email, and phone to start. You can fill in the rest after."}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="hp-name" className="block text-sm font-medium">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="hp-name"
                  type="text"
                  required
                  maxLength={HIRING_PARTNERS_MAX.contactName}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label htmlFor="hp-email" className="block text-sm font-medium">
                  Email
                </label>
                <input
                  id="hp-email"
                  type="email"
                  value={user.email || ""}
                  readOnly
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400"
                />
              </div>
              <div>
                <label htmlFor="hp-phone" className="block text-sm font-medium">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="hp-phone"
                  type="tel"
                  required
                  maxLength={HIRING_PARTNERS_MAX.phone}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Company info — optional, fill in anytime
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="hp-company" className="block text-sm font-medium">
                      Company name
                    </label>
                    <input
                      id="hp-company"
                      type="text"
                      maxLength={HIRING_PARTNERS_MAX.companyName}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="hp-website" className="block text-sm font-medium">
                      Company website
                    </label>
                    <input
                      id="hp-website"
                      type="url"
                      maxLength={HIRING_PARTNERS_MAX.companyWebsite}
                      placeholder="https://"
                      value={companyWebsite}
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="hp-role" className="block text-sm font-medium">
                      Your role / title
                    </label>
                    <input
                      id="hp-role"
                      type="text"
                      maxLength={HIRING_PARTNERS_MAX.contactRole}
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="hp-roles-hiring" className="block text-sm font-medium">
                      What roles are you hiring for?
                    </label>
                    <textarea
                      id="hp-roles-hiring"
                      rows={3}
                      maxLength={HIRING_PARTNERS_MAX.rolesHiring}
                      placeholder="e.g. founding engineer, AI eng, internships…"
                      value={rolesHiring}
                      onChange={(e) => setRolesHiring(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="hp-notes" className="block text-sm font-medium">
                      Anything else?
                    </label>
                    <textarea
                      id="hp-notes"
                      rows={3}
                      maxLength={HIRING_PARTNERS_MAX.notes}
                      placeholder="Sponsorship interest, comp range, anything that helps us route candidates."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                </div>
              </div>

              {/* $150k engineer profile — optional Likert + open requirements */}
              <div className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  $150k engineer profile — optional
                </p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  What does a $150k/year engineer look like to you? Rate how
                  important each of the following is when evaluating a candidate
                  at that level. <span className="font-medium">1 = nice to have</span>,{" "}
                  <span className="font-medium">7 = critical</span>.
                </p>

                <div className="mt-4 space-y-3">
                  {PARTNER_ENGINEER_EXPECTATION_ITEMS.map((item) => {
                    const value = engineerExpectations[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="flex-1 text-sm text-neutral-800 dark:text-neutral-200">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-neutral-500">
                          <span className="hidden sm:inline">1</span>
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <label
                              key={n}
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-neutral-300 hover:border-emerald-500 dark:border-neutral-700"
                              style={
                                value === n
                                  ? { backgroundColor: "#10b981", color: "white", borderColor: "#10b981" }
                                  : undefined
                              }
                            >
                              <input
                                type="radio"
                                name={`hp-exp-${item.key}`}
                                value={n}
                                checked={value === n}
                                onChange={() =>
                                  setEngineerExpectations((prev) => ({
                                    ...prev,
                                    [item.key]: n,
                                  }))
                                }
                                className="sr-only"
                              />
                              <span className="text-xs font-medium">{n}</span>
                            </label>
                          ))}
                          <span className="hidden sm:inline">7</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <label
                    htmlFor="hp-engineer-requirements"
                    className="block text-sm font-medium"
                  >
                    Specific hiring requirements at this level
                  </label>
                  <p className="mt-1 text-xs text-neutral-500">
                    Anything not captured above — must-have technologies,
                    certifications, dealbreakers, comp band specifics,
                    location/visa constraints, etc.
                  </p>
                  <textarea
                    id="hp-engineer-requirements"
                    rows={4}
                    maxLength={HIRING_PARTNERS_MAX.engineerRequirements}
                    value={engineerRequirements}
                    onChange={(e) => setEngineerRequirements(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
              </div>

              {submitError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              ) : null}
              {submitSuccess ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {submitSuccess}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {submitting
                    ? application
                      ? "Saving…"
                      : "Submitting…"
                    : application
                      ? "Save"
                      : "Submit application"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
