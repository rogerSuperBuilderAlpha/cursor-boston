"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/api-client";
import type { BoardFullPayload, Card } from "@/lib/pm/types";
import { BoardView } from "@/components/kanban/BoardView";
import { CardModal } from "@/components/kanban/CardModal";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { Button } from "@/components/ui/Button";

export function BoardPageClient({ boardId }: { boardId: string }) {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const api = useApi();
  const [data, setData] = useState<BoardFullPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<Card | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await api(`/api/boards/${boardId}`);
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    if (res.status === 403) {
      setError("You are not a member of this workspace. Join from the home page with the invite code.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load board.");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as BoardFullPayload;
    setData(json);
    setError(null);
    setLoading(false);
  }, [api, boardId, router, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    void load();
  }, [authLoading, user, load, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n" || e.key === "N") {
        const first = data?.board.columnOrder[0] ?? data?.columns[0]?.id;
        if (first) {
          setModalCard(null);
          setModalColumnId(first);
          setModalOpen(true);
        }
      }
      if (e.key === "Escape") {
        setModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data]);

  const onOpenCard = useCallback((card: Card) => {
    setModalCard(card);
    setModalColumnId(card.columnId);
    setModalOpen(true);
  }, []);

  const onAddCard = useCallback((columnId: string) => {
    setModalCard(null);
    setModalColumnId(columnId);
    setModalOpen(true);
  }, []);

  if (authLoading || (loading && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-zinc-300">{error}</p>
        <Button className="mt-4" onClick={() => router.push("/")}>
          Back home
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Link href="/" className="hover:text-emerald-400">
                Shipboard
              </Link>
              <span>/</span>
              <span>{data.board.weekLabel}</span>
            </div>
            <h1 className="text-xl font-semibold text-zinc-100">{data.board.title}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="hidden sm:inline">
              Press <kbd className="rounded border border-zinc-700 px-1">n</kbd> new card
            </span>
            <span>{user?.displayName || user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 lg:flex-row">
        <section className="min-h-0 min-w-0 flex-1 overflow-x-auto">
          <BoardView
            boardId={boardId}
            board={data.board}
            columns={data.columns}
            cards={data.cards}
            labels={data.labels}
            members={data.members}
            onRefresh={load}
            onAddCard={onAddCard}
            onOpenCard={onOpenCard}
          />
        </section>
        <aside className="h-[480px] w-full shrink-0 lg:h-auto lg:max-w-md lg:flex-1">
          <NotesPanel
            boardId={boardId}
            initialScratch={data.scratch}
            onScratchRemoteUpdate={load}
          />
        </aside>
      </main>

      <CardModal
        boardId={boardId}
        open={modalOpen}
        columnId={modalColumnId}
        card={modalCard}
        labels={data.labels}
        members={data.members}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  );
}
