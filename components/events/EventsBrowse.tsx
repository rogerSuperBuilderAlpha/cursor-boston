/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo } from "react";
import type { Event } from "@/types/events";
import { partitionEventsForBrowse } from "@/lib/events-calendar-buckets";
import { getLumaCheckoutHref } from "@/lib/luma-event";
import styles from "./EventsBrowse.module.css";

type Props = {
  events: Event[];
  /** Boston calendar day `YYYY-MM-DD` from the server; must match SSR for hydration. */
  listingTodayYmd: string;
};

function PastStyleEventCard({ event }: { event: Event }) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors flex flex-col">
      <span className="inline-block px-2.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full mb-3 capitalize">
        {event.type}
      </span>
      <h3 className="text-lg font-semibold text-foreground mb-2">{event.title}</h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
        {event.date === "TBD"
          ? "Date TBD"
          : new Date(event.date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
      </p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
        {event.location}
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4 flex-1">
        {event.description}
      </p>
      <div className="flex flex-col gap-2 mt-auto">
        {event.primaryCtaHref ? (
          <Link
            href={event.primaryCtaHref}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white"
          >
            {event.primaryCtaLabel ?? "Open"}
          </Link>
        ) : null}
        <Link
          href={`/events/${event.slug}`}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-neutral-300 dark:border-neutral-700 text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
            event.primaryCtaHref
              ? ""
              : "bg-neutral-900 text-white dark:bg-white dark:text-black border-transparent hover:bg-neutral-700 dark:hover:bg-neutral-200"
          }`}
        >
          {event.primaryCtaHref ? "Event recap" : "View details"}
        </Link>
      </div>
    </div>
  );
}

export function EventsBrowse({ events, listingTodayYmd }: Props) {
  const { today, future, past } = useMemo(
    () => partitionEventsForBrowse(events, listingTodayYmd),
    [events, listingTodayYmd]
  );

  const reactId = useId().replace(/:/g, "");
  const groupName = `events-browse-tab-${reactId}`;
  const idToday = `${groupName}-today`;
  const idFuture = `${groupName}-future`;
  const idPast = `${groupName}-past`;

  const defaultTab: "today" | "future" | "past" =
    today.length > 0 ? "today" : future.length > 0 ? "future" : "past";

  return (
    <div className="max-w-6xl mx-auto">
      {/*
        Three radios first, then tab labels, then panels — CSS ~ siblings show the active panel.
        Native labels toggle radios without React state (works even if client hydration is flaky).
      */}
      <input
        type="radio"
        name={groupName}
        id={idToday}
        className={`${styles.srOnlyRadio} ${styles.radioToday}`}
        defaultChecked={defaultTab === "today"}
      />
      <input
        type="radio"
        name={groupName}
        id={idFuture}
        className={`${styles.srOnlyRadio} ${styles.radioFuture}`}
        defaultChecked={defaultTab === "future"}
      />
      <input
        type="radio"
        name={groupName}
        id={idPast}
        className={`${styles.srOnlyRadio} ${styles.radioPast}`}
        defaultChecked={defaultTab === "past"}
      />

      <div className={styles.tabBar} role="tablist" aria-label="Event listings">
        <label htmlFor={idToday} className={styles.tabLabel} role="tab">
          TODAY
        </label>
        <label htmlFor={idFuture} className={styles.tabLabel} role="tab">
          FUTURE
        </label>
        <label htmlFor={idPast} className={styles.tabLabel} role="tab">
          PAST
        </label>
      </div>

      <div className={styles.panels}>
        <div
          className={styles.panel}
          role="tabpanel"
          id={`${groupName}-panel-today`}
          aria-labelledby={idToday}
        >
          {today.length > 0 ? (
            <div className="grid gap-8">
              {today.map((event) => (
                <FeaturedEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-neutral-800">
              <p className="text-neutral-600 dark:text-neutral-400">
                No events scheduled for today.
              </p>
            </div>
          )}
        </div>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`${groupName}-panel-future`}
          aria-labelledby={idFuture}
        >
          {future.length > 0 ? (
            <div className="grid gap-8">
              {future.map((event) => (
                <FeaturedEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-neutral-800">
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                No upcoming events scheduled yet.
              </p>
              <a
                href="https://lu.ma/cursor-boston"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline focus-visible:outline-none focus-visible:underline"
              >
                Subscribe on Luma to get notified &rarr;
              </a>
            </div>
          )}
        </div>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`${groupName}-panel-past`}
          aria-labelledby={idPast}
        >
          {past.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.map((event) => (
                <PastStyleEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-neutral-800">
              <p className="text-neutral-600 dark:text-neutral-400">
                Past events will appear here after our first event.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Large hero-style card; register uses a normal Luma link (no checkout embed) so clicks always navigate. */
function FeaturedEventCard({ event }: { event: Event }) {
  const registerHref =
    event.lumaUrl?.trim() || getLumaCheckoutHref(event);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
      <div className="grid md:grid-cols-2 gap-0">
        <div className="relative aspect-9/16 md:aspect-auto md:min-h-[400px] bg-neutral-100 dark:bg-neutral-800 isolate">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-contain pointer-events-none"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute bottom-[2%] right-[3%] z-20 w-[15%] aspect-square bg-white p-1 rounded pointer-events-none">
            <Image
              src="/luma-qr.png"
              alt="Scan to register"
              fill
              className="object-contain"
            />
          </div>
        </div>
        <div className="p-8 flex flex-col justify-center relative z-10">
          <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-full mb-4 w-fit capitalize">
            {event.type}
          </span>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            {event.title}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
            {event.description}
          </p>
          {event.topics && event.topics.length > 0 ? (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                Topics Covered
              </h4>
              <div className="flex flex-wrap gap-2">
                {event.topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm rounded-full"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{event.location}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 relative z-10">
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-base font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black w-full sm:w-auto"
            >
              View Details
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href={registerHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Register for ${event.title} (opens in new tab)`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-base font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black w-full sm:w-auto"
            >
              Register on Luma
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
