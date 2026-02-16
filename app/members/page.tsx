"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { MemberDirectory } from "@/components/members/MemberDirectory";
import { CommunityFeed } from "@/components/feed/CommunityFeed";

type PageTab = "members" | "feed";

function MembersPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageTab>("members");
  const searchQuery = searchParams.get("search") || "";

  // Switch to members tab and search for a specific user
  const viewMemberProfile = (authorName: string) => {
    setActiveTab("members");
    router.push(`/members?search=${encodeURIComponent(authorName)}`, { scroll: false });
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-12 md:py-16 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Community
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
            Connect with developers, designers, and innovators building with Cursor in Boston.
          </p>
          
          {/* Tabs */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setActiveTab("members")}
              className={`px-6 py-2.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === "members"
                  ? "bg-emerald-500 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              <span className="flex items-center gap-2">
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Members
              </span>
            </button>
            <button
              onClick={() => setActiveTab("feed")}
              className={`px-6 py-2.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === "feed"
                  ? "bg-emerald-500 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              <span className="flex items-center gap-2">
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Feed
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Tab Content */}
      {activeTab === "feed" ? (
        <CommunityFeed user={user} onViewMemberProfile={viewMemberProfile} />
      ) : (
        <MemberDirectory key={searchQuery} initialSearch={searchQuery} />
      )}

      {/* CTA */}
      <section className="py-16 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Want to be listed here?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-lg mb-8">
            Create an account and make your profile public to connect with other
            community members.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950"
          >
            Set Up Your Profile
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white"></div>
        </div>
      }
    >
      <MembersPageContent />
    </Suspense>
  );
}
