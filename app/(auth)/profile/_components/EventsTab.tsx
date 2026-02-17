"use client";

import Link from "next/link";
import { CalendarIcon } from "../_icons/icons";
import { EventRegistration } from "@/lib/registrations";

interface EventsTabProps {
  registrations: EventRegistration[];
  loadingData: boolean;
}

export function EventsTab({ registrations, loadingData }: EventsTabProps) {
  return (
    <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">My Event Registrations</h2>
        <Link href="/events" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium focus-visible:outline-none focus-visible:underline">
          Browse Events
        </Link>
      </div>

      {loadingData ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
        </div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="text-neutral-600 w-8 h-8" />
          </div>
          <p className="text-neutral-400 mb-4">You haven&apos;t registered for any events yet</p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <div key={reg.id} className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">{reg.eventTitle}</p>
                  <p className="text-neutral-400 text-sm">{reg.eventDate || "Date TBD"}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 text-sm rounded-full ${
                  reg.status === "attended"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : reg.status === "cancelled"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >
                {reg.status === "attended" ? "Attended" : reg.status === "cancelled" ? "Cancelled" : "Registered"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
