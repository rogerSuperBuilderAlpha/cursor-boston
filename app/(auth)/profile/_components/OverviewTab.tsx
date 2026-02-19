"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarIcon, DiscordIcon, LayersIcon, PlusIcon, UserCardIcon } from "@/components/icons";
import { EventRegistration } from "@/lib/registrations";

interface TalkSubmission {
  id: string;
  title: string;
  status: string;
  submittedAt: { toDate: () => Date } | null;
}

interface ConnectedAgent {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
}

interface OverviewTabProps {
  registrations: EventRegistration[];
  talkSubmissions: TalkSubmission[];
  connectedAgents: ConnectedAgent[];
  loadingData: boolean;
  loadingAgents: boolean;
}

export function OverviewTab({
  registrations,
  talkSubmissions,
  connectedAgents,
  loadingData,
  loadingAgents,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/events"
            className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <CalendarIcon size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-medium">Browse Events</p>
              <p className="text-neutral-400 text-sm">Find upcoming meetups &amp; workshops</p>
            </div>
          </Link>

          <Link
            href="/talks/submit"
            className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <LayersIcon size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-medium">Submit a Talk</p>
              <p className="text-neutral-400 text-sm">Share your knowledge with the community</p>
            </div>
          </Link>

          <a
            href="https://discord.gg/Wsncg8YYqc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="w-10 h-10 bg-[#5865F2]/10 rounded-lg flex items-center justify-center">
              <DiscordIcon size={20} className="text-[#5865F2]" />
            </div>
            <div>
              <p className="text-white font-medium">Join Discord</p>
              <p className="text-neutral-400 text-sm">Connect with the community</p>
            </div>
          </a>

          <Link
            href="/events/request"
            className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <PlusIcon size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-medium">Request an Event</p>
              <p className="text-neutral-400 text-sm">Suggest a workshop or meetup</p>
            </div>
          </Link>
        </div>
      </div>

      {/* AI Agents */}
      {(connectedAgents.length > 0 || loadingAgents) && (
        <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserCardIcon size={20} className="text-purple-400" />
              Your AI Agents
            </h2>
            <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">
              {connectedAgents.length} connected
            </span>
          </div>
          {loadingAgents ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {connectedAgents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-4 p-4 bg-neutral-800/50 rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    {agent.avatarUrl ? (
                      <Image src={agent.avatarUrl} alt={agent.name} width={48} height={48} className="rounded-full" />
                    ) : (
                      <UserCardIcon size={24} className="text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{agent.name}</p>
                    {agent.description && (
                      <p className="text-neutral-400 text-sm truncate">{agent.description}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">Active</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        {loadingData ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
          </div>
        ) : registrations.length === 0 && talkSubmissions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-400 mb-4">No activity yet</p>
            <Link href="/events" className="text-emerald-400 hover:text-emerald-300 font-medium focus-visible:outline-none focus-visible:underline">
              Browse upcoming events &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.slice(0, 3).map((reg) => (
              <div key={reg.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">Registered for {reg.eventTitle}</p>
                  <p className="text-neutral-400 text-xs">
                    {reg.registeredAt?.toDate ? reg.registeredAt.toDate().toLocaleDateString() : "Recently"}
                  </p>
                </div>
              </div>
            ))}
            {talkSubmissions.slice(0, 3).map((talk) => (
              <div key={talk.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg">
                <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400" aria-hidden="true">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">Submitted talk: {talk.title}</p>
                  <p className="text-neutral-400 text-xs capitalize">Status: {talk.status || "pending"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
