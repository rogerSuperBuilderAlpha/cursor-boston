"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { DEFAULT_BOARD_ID } from "@/lib/pm/constants";

export default function HomePage() {
  const { user, loading, signInWithGoogle, signInWithGithub, signOut } = useAuth();
  const api = useApi();
  const router = useRouter();
  const [invite, setInvite] = useState("");
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const res = await api("/api/workspaces");
      if (!res.ok) return;
      const data = (await res.json()) as { workspaces: { id: string }[]; suggestedBoardId: string };
      if (data.workspaces.length > 0) {
        router.replace(`/boards/${data.suggestedBoardId ?? DEFAULT_BOARD_ID}`);
      }
    })();
  }, [user, api, router]);

  const join = async () => {
    setBusy(true);
    setJoinMsg(null);
    try {
      const res = await api("/api/workspaces/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: invite }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setJoinMsg(j.error ?? "Could not join");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { boardId: string };
      router.replace(`/boards/${data.boardId}`);
    } catch {
      setJoinMsg("Network error");
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading…</div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Shipboard</h1>
        <p className="mt-2 text-zinc-400">
          Kanban plus running notes for cohort weekly shipping. Sign in, then join with your cohort
          invite code.
        </p>

        {!user ? (
          <div className="mt-8 space-y-3">
            <Button className="w-full" onClick={() => void signInWithGoogle()}>
              Continue with Google
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void signInWithGithub()}>
              Continue with GitHub
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-zinc-500">
              Signed in as {user.displayName || user.email}
            </p>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Cohort invite code
              </label>
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                className="focus-ring mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
                placeholder="Paste invite code"
                autoComplete="off"
              />
              {joinMsg ? <p className="mb-3 text-sm text-red-400">{joinMsg}</p> : null}
              <Button className="w-full" disabled={busy || !invite.trim()} onClick={() => void join()}>
                {busy ? "Joining…" : "Join workspace"}
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-zinc-600">
          After deploying, set <code className="text-zinc-500">COHORT_INVITE_CODE</code> in Vercel
          env.
        </p>
      </div>
    </div>
  );
}
