"use client";

import Link from "next/link";
import { StackIcon } from "@/components/icons";

interface TalkSubmission {
  id: string;
  title: string;
  status: string;
  submittedAt: { toDate: () => Date } | null;
}

interface TalksTabProps {
  talkSubmissions: TalkSubmission[];
  loadingData: boolean;
}

export function TalksTab({ talkSubmissions, loadingData }: TalksTabProps) {
  return (
    <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">My Talk Submissions</h2>
        <Link href="/talks/submit" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium focus-visible:outline-none focus-visible:underline">
          Submit a Talk
        </Link>
      </div>

      {loadingData ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
        </div>
      ) : talkSubmissions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <StackIcon className="text-neutral-600 w-8 h-8" />
          </div>
          <p className="text-neutral-400 mb-4">You haven&apos;t submitted any talks yet</p>
          <Link
            href="/talks/submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Submit a Talk
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {talkSubmissions.map((talk) => (
            <div key={talk.id} className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <StackIcon className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium">{talk.title}</p>
                  <p className="text-neutral-400 text-sm">
                    {talk.submittedAt?.toDate
                      ? talk.submittedAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Recently submitted"}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 text-sm rounded-full capitalize ${
                  talk.status === "approved"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : talk.status === "completed"
                    ? "bg-purple-500/10 text-purple-400"
                    : talk.status === "rejected"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-yellow-500/10 text-yellow-400"
                }`}
              >
                {talk.status || "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
