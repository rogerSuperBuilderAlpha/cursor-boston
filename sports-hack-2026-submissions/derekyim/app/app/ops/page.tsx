"use client";

import { useState, useEffect, useCallback } from "react";

interface Scores {
  energy: number;
  celtics_rep: number;
  originality: number;
  safety: number;
}

interface Submission {
  id: string;
  mode: "hype" | "roast";
  name: string;
  section: string;
  thumbnail: string;
  createdAt: number;
  status: "pending" | "scored" | "approved" | "rejected";
  scores: Scores | null;
  composite_score: number;
  safety_flagged: boolean;
  vision_description: string | null;
  roast_candidates: string[];
  roast_chosen: string | null;
  dunkinWinner: boolean;
}

export default function OpsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<"all" | "hype" | "roast">("all");
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions?full=1");
      const data = await res.json();
      setSubmissions(data);
    } catch {
      // silent retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 2000);
    return () => clearInterval(interval);
  }, [fetchSubmissions]);

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/submissions/${id}/approve`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.dunkinWinner) {
      alert(
        `DUNKIN WINNER! ${data.name} wins a FREE Large Iced Coffee from Dunkin!`
      );
    }
    fetchSubmissions();
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/submissions/${id}/reject`, { method: "POST" });
    fetchSubmissions();
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the queue entirely?`)) return;
    await fetch(`/api/submissions/${id}/remove`, { method: "POST" });
    fetchSubmissions();
  };

  const handlePickRoast = async (id: string, roast: string) => {
    await fetch(`/api/submissions/${id}/pick-roast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roast }),
    });
    fetchSubmissions();
  };

  const filtered = submissions.filter(
    (s) => filter === "all" || s.mode === filter
  );

  const approvedRoasts = submissions.filter(
    (s) => s.mode === "roast" && s.status === "approved"
  ).length;
  const nextDunkinIn = 5 - (approvedRoasts % 5);

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500",
    scored: "bg-blue-500",
    approved: "bg-green-500",
    rejected: "bg-red-500",
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              GREEN OR MEAN — OPS
            </h1>
            <p className="text-sm text-gray-400">
              {submissions.length} submission{submissions.length !== 1 && "s"}{" "}
              &middot; auto-refreshing every 2s
            </p>
            <p className="text-sm text-orange-400 mt-1">
              Next Dunkin winner in {nextDunkinIn} roast
              {nextDunkinIn !== 1 && "s"} &middot; {approvedRoasts} approved
              roasts total
            </p>
          </div>

          <div className="flex gap-2">
            {(["all", "hype", "roast"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-semibold capitalize transition-colors ${
                  filter === f
                    ? "bg-celtics-green text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-gray-500 text-center py-12">
            No submissions yet. Share the QR code!
          </p>
        )}

        <div className="grid gap-4">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className={`bg-gray-900 rounded-xl p-4 flex gap-4 items-start border ${
                sub.dunkinWinner
                  ? "border-orange-500 ring-2 ring-orange-500/40"
                  : sub.status === "approved"
                  ? "border-green-600"
                  : sub.status === "rejected"
                  ? "border-red-600/40"
                  : "border-gray-800"
              } ${sub.status === "rejected" ? "opacity-50" : ""}`}
            >
              <img
                src={sub.thumbnail}
                alt={sub.name}
                className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-lg">{sub.name}</span>
                  <span className="text-sm text-gray-400">
                    Sec {sub.section}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                      sub.mode === "hype"
                        ? "bg-celtics-green/20 text-green-400"
                        : "bg-celtics-gold/20 text-yellow-400"
                    }`}
                  >
                    {sub.mode}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      statusColor[sub.status]
                    }`}
                  >
                    {sub.status}
                  </span>
                  {sub.safety_flagged && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-700 font-semibold">
                      SAFETY
                    </span>
                  )}
                  {sub.dunkinWinner && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500 text-black font-bold">
                      DUNKIN WINNER
                    </span>
                  )}
                </div>

                {sub.scores && (
                  <div className="flex gap-3 text-xs text-gray-400 mb-2">
                    <span>
                      Energy:{" "}
                      <strong className="text-white">
                        {sub.scores.energy}
                      </strong>
                    </span>
                    <span>
                      Celtics:{" "}
                      <strong className="text-white">
                        {sub.scores.celtics_rep}
                      </strong>
                    </span>
                    <span>
                      Original:{" "}
                      <strong className="text-white">
                        {sub.scores.originality}
                      </strong>
                    </span>
                    <span>
                      Safety:{" "}
                      <strong className="text-white">
                        {sub.scores.safety}
                      </strong>
                    </span>
                    <span>
                      Composite:{" "}
                      <strong className="text-celtics-gold text-sm">
                        {sub.composite_score}
                      </strong>
                    </span>
                  </div>
                )}

                {sub.vision_description && (
                  <p className="text-xs text-gray-500 italic mb-2">
                    {sub.vision_description}
                  </p>
                )}

                {sub.mode === "roast" && sub.roast_candidates.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1 font-semibold">
                      Roast options:
                    </p>
                    <div className="flex flex-col gap-1">
                      {sub.roast_candidates.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => handlePickRoast(sub.id, r)}
                          className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                            sub.roast_chosen === r
                              ? "bg-celtics-gold/30 text-celtics-gold border border-celtics-gold/50"
                              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          &ldquo;{r}&rdquo;
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  {sub.status !== "approved" && sub.status !== "rejected" && (
                    <>
                      <button
                        onClick={() => handleApprove(sub.id)}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(sub.id)}
                        className="px-4 py-1.5 bg-red-600/70 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleRemove(sub.id, sub.name)}
                    className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
