/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  PYDATA_2026_EVENT_SLUG,
  PYDATA_2026_LUMA_URL,
  PYDATA_2026_REGISTRATION_PATH,
  type PydataRegistration,
} from "@/lib/pydata-2026";

const API_PATH = "/api/events/pydata-2026/registration";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  attendingConfirmed: boolean;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  organization: "",
  attendingConfirmed: false,
};

function splitDisplayName(displayName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function PyDataRegisterPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [registration, setRegistration] = useState<PydataRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRegistration(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(API_PATH, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.registered && json.registration) {
        setRegistration(json.registration as PydataRegistration);
      } else {
        setRegistration(null);
      }
    } catch {
      setRegistration(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch on auth resolution
    void load();
  }, [authLoading, load]);

  // Prefill form fields from the auth profile once we know nothing's saved yet.
  useEffect(() => {
    if (loading || registration) return;
    const { firstName, lastName } = splitDisplayName(userProfile?.displayName ?? null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot prefill once auth resolves
    setForm((prev) => ({
      firstName: prev.firstName || firstName,
      lastName: prev.lastName || lastName,
      email: prev.email || (user?.email ?? ""),
      phone: prev.phone,
      organization: prev.organization,
      attendingConfirmed: prev.attendingConfirmed,
    }));
  }, [loading, registration, user?.email, userProfile?.displayName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(json.missingFields) && json.missingFields.length > 0) {
          throw new Error(`Please fix: ${json.missingFields.join(", ")}`);
        }
        throw new Error(json.error || "Could not submit");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/events" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Events
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/events/${PYDATA_2026_EVENT_SLUG}`}
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            PyData × Cursor Boston
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">Register</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          PyData × Cursor Boston — Confirm attendance
        </h1>
        <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400">
          Wednesday May 13 · Moderna HQ, Cambridge. Confirm here so we can hand
          your name to Moderna for Envoy registration and badge issuance. You
          still need to RSVP on{" "}
          <a
            href={PYDATA_2026_LUMA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
          >
            Luma
          </a>{" "}
          for the door list.
        </p>
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <strong>Use your full legal name</strong> exactly as it appears on the
          government-issued ID you&apos;ll bring to the door (driver&apos;s
          license or passport). Moderna will turn you away if the names
          don&apos;t match.
        </p>

        <div className="mt-10">
          {authLoading || loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm text-neutral-500">Loading…</p>
            </div>
          ) : !user ? (
            <SignInGate />
          ) : registration ? (
            <AwaitingBadge registration={registration} onEdit={() => setRegistration(null)} />
          ) : (
            <RegistrationForm
              form={form}
              setForm={setForm}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function SignInGate() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-neutral-700 dark:text-neutral-300 mb-4">
        Sign in or create an account to confirm your attendance.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/login?redirect=${encodeURIComponent(PYDATA_2026_REGISTRATION_PATH)}`}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Sign in
        </Link>
        <Link
          href={`/signup?redirect=${encodeURIComponent(PYDATA_2026_REGISTRATION_PATH)}`}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

function RegistrationForm({
  form,
  setForm,
  submitting,
  error,
  onSubmit,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const inputClass =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">First name</span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={form.firstName}
            onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            className={inputClass}
            autoComplete="given-name"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Last name</span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={form.lastName}
            onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            className={inputClass}
            autoComplete="family-name"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Email</span>
          <input
            type="email"
            required
            maxLength={320}
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className={inputClass}
            autoComplete="email"
          />
          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
            Use the same email you used on Luma so Moderna can match you. The
            Envoy NDA + QR code will be sent here from{" "}
            <code>no-reply@envoy.com</code>.
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">
            Phone <span className="font-normal text-neutral-500">(optional)</span>
          </span>
          <input
            type="tel"
            maxLength={40}
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className={inputClass}
            autoComplete="tel"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Organization</span>
          <input
            type="text"
            required
            maxLength={200}
            value={form.organization}
            onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
            className={inputClass}
            placeholder="Company, university, or independent"
            autoComplete="organization"
          />
        </label>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.attendingConfirmed}
          onChange={(e) =>
            setForm((p) => ({ ...p, attendingConfirmed: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 rounded border-neutral-400 text-emerald-500 focus:ring-emerald-500"
          required
        />
        <span className="text-neutral-700 dark:text-neutral-300">
          I confirm I&apos;ll attend on Wednesday May 13 at Moderna HQ. I understand
          Moderna requires Envoy sign-in (NDA + signature) before I can enter and
          that no QR code means no access.
        </span>
      </label>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Confirm attendance"}
        </button>
        <Link
          href={`/events/${PYDATA_2026_EVENT_SLUG}`}
          className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Back to event details
        </Link>
      </div>
    </form>
  );
}

function AwaitingBadge({
  registration,
  onEdit,
}: {
  registration: PydataRegistration;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 dark:bg-emerald-500/10">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">
            You&apos;re confirmed — awaiting badge
          </h2>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            We&apos;ve recorded your attendance for the Cursor Boston × PyData
            hack at Moderna on Wednesday May 13. Moderna will issue your badge
            on arrival once Envoy sign-in is complete.
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-emerald-500/20 bg-white p-4 text-sm dark:bg-neutral-900 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Name
          </dt>
          <dd className="mt-1 text-neutral-900 dark:text-neutral-100">
            {registration.firstName} {registration.lastName}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Email
          </dt>
          <dd className="mt-1 break-all text-neutral-900 dark:text-neutral-100">
            {registration.email}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Phone
          </dt>
          <dd className="mt-1 text-neutral-900 dark:text-neutral-100">
            {registration.phone || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Organization
          </dt>
          <dd className="mt-1 text-neutral-900 dark:text-neutral-100">
            {registration.organization}
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-semibold">What to expect next</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            We send your name + email to Moderna 48 hours before the event.
          </li>
          <li>
            Moderna registers you in Envoy. You&apos;ll get an email from{" "}
            <code>Moderna HQ &lt;no-reply@envoy.com&gt;</code> with NDA paperwork
            to sign.
          </li>
          <li>
            After signing, Envoy emails you a unique QR code. <strong>Bring
            that QR code on your phone</strong> on May 13.
          </li>
          <li>
            <strong>Bring a government-issued ID</strong> (driver&apos;s license
            or passport) with the name <strong>{registration.firstName} {registration.lastName}</strong>.
            If it doesn&apos;t match, you&apos;ll be turned away.
          </li>
          <li>
            If you don&apos;t get the Envoy email but you registered on time,
            you can still sign the NDA on paper at the door — but if your name
            isn&apos;t on the list, you won&apos;t be admitted.
          </li>
          <li>
            Don&apos;t forget to RSVP on{" "}
            <a
              href={PYDATA_2026_LUMA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Luma
            </a>{" "}
            if you haven&apos;t already.
          </li>
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={PYDATA_2026_LUMA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Open Luma RSVP
        </a>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Edit details
        </button>
        <Link
          href={`/events/${PYDATA_2026_EVENT_SLUG}`}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Back to event
        </Link>
      </div>
    </div>
  );
}
