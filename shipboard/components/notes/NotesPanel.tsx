"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/api-client";
import type { NoteEntry, ScratchDoc } from "@/lib/pm/types";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

type Tab = "stream" | "scratch";

export function NotesPanel({
  boardId,
  initialScratch,
  onScratchRemoteUpdate,
}: {
  boardId: string;
  initialScratch: ScratchDoc;
  onScratchRemoteUpdate?: () => void;
}) {
  const api = useApi();
  const [tab, setTab] = useState<Tab>("stream");
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [composer, setComposer] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [scratchBody, setScratchBody] = useState(initialScratch.body);
  const [scratchSave, setScratchSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialScratch.body);

  const loadNotes = useCallback(async () => {
    const res = await api(`/api/boards/${boardId}/notes`);
    if (!res.ok) return;
    const data = (await res.json()) as { notes: NoteEntry[] };
    setNotes(data.notes);
  }, [api, boardId]);

  useEffect(() => {
    void (async () => {
      setLoadingNotes(true);
      await loadNotes();
      setLoadingNotes(false);
    })();
  }, [loadNotes]);

  const postNote = async () => {
    const body = composer.trim();
    if (!body) return;
    const res = await api(`/api/boards/${boardId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setComposer("");
      await loadNotes();
    }
  };

  useEffect(() => {
    setScratchBody(initialScratch.body);
    lastSaved.current = initialScratch.body;
  }, [initialScratch.body]);

  const saveScratchNow = useCallback(
    async (body: string) => {
      setScratchSave("saving");
      const res = await api(`/api/boards/${boardId}/scratch`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        lastSaved.current = body;
        setScratchSave("saved");
        onScratchRemoteUpdate?.();
        setTimeout(() => setScratchSave("idle"), 1500);
      } else {
        setScratchSave("error");
      }
    },
    [api, boardId, onScratchRemoteUpdate],
  );

  useEffect(() => {
    if (scratchBody === lastSaved.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveScratchNow(scratchBody);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scratchBody, saveScratchNow]);

  const statusText = useMemo(() => {
    if (scratchSave === "saving") return "Saving…";
    if (scratchSave === "saved") return "Saved";
    if (scratchSave === "error") return "Save failed";
    return "";
  }, [scratchSave]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950/80">
      <div className="flex border-b border-zinc-800">
        <button
          type="button"
          className={cnTab(tab === "stream")}
          onClick={() => setTab("stream")}
        >
          Stream
        </button>
        <button
          type="button"
          className={cnTab(tab === "scratch")}
          onClick={() => setTab("scratch")}
        >
          Scratch doc
        </button>
      </div>

      {tab === "stream" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-zinc-800 p-3">
            <p className="mb-2 text-xs text-zinc-500">What shipped today?</p>
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Markdown supported"
              rows={3}
              className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <Button size="sm" onClick={() => void postNote()}>
              Post update
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loadingNotes ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-zinc-500">No updates yet.</p>
            ) : (
              <ul className="space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-300">{n.authorName}</span>
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeSanitize]}
                      >
                        {n.body}
                      </ReactMarkdown>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>Longer notes & plans (auto-saves)</span>
            <span>{statusText}</span>
          </div>
          <textarea
            value={scratchBody}
            onChange={(e) => setScratchBody(e.target.value)}
            className="min-h-[320px] w-full flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-sm text-zinc-100"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

function cnTab(active: boolean) {
  return [
    "flex-1 px-4 py-2 text-sm font-medium transition",
    active
      ? "border-b-2 border-emerald-500 text-emerald-400"
      : "text-zinc-500 hover:text-zinc-300",
  ].join(" ");
}
