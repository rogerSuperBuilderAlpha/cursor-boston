"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarIcon, StackIcon, AgentIcon } from "../_icons/icons";
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
              <CalendarIcon className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-medium">Browse Events</p>
              <p className="text-neutral-400 text-sm">Find upcoming meetups & workshops</p>
            </div>
          </Link>

          <Link
            href="/talks/submit"
            className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <StackIcon className="text-emerald-400" />
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#5865F2]" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
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
              <AgentIcon className="text-purple-400" />
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
                      <AgentIcon className="text-purple-400" />
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
