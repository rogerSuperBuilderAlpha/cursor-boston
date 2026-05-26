"use client";

import { useEffect, useState } from "react";
import type { Card, Label } from "@/lib/pm/types";
import { Button, Modal } from "@/components/ui/Button";
import { useApi } from "@/lib/api-client";

export function CardModal({
  boardId,
  open,
  columnId,
  card,
  labels,
  members,
  onClose,
  onSaved,
  onDeleted,
}: {
  boardId: string;
  open: boolean;
  columnId: string | null;
  card: Card | null;
  labels: Label[];
  members: { uid: string; displayName: string | null }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const api = useApi();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | "">("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isNew = !card;

  useEffect(() => {
    if (!open) return;
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? "");
      setAssigneeId(card.assigneeId ?? "");
      setLabelIds(card.labelIds);
    } else {
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setLabelIds([]);
    }
  }, [open, card]);

  const toggleLabel = (id: string) => {
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        if (!columnId) return;
        const res = await api(`/api/boards/${boardId}/cards`, {
          method: "POST",
          body: JSON.stringify({
            columnId,
            title: title.trim(),
            description: description.trim() || undefined,
            assigneeId: assigneeId || null,
            labelIds,
          }),
        });
        if (!res.ok) throw new Error("Create failed");
      } else if (card) {
        const res = await api(`/api/boards/${boardId}/cards/${card.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            assigneeId: assigneeId || null,
            labelIds,
          }),
        });
        if (!res.ok) throw new Error("Update failed");
      }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    if (!confirm("Delete this card?")) return;
    setSaving(true);
    try {
      const res = await api(`/api/boards/${boardId}/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await onDeleted();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "New card" : "Edit card"}
      footer={
        <>
          {!isNew ? (
            <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="focus-ring w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="focus-ring w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Assignee</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="focus-ring w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName ?? m.uid}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-2 text-xs text-zinc-500">Labels</p>
          <div className="flex flex-wrap gap-2">
            {labels.map((lb) => (
              <label key={lb.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={labelIds.includes(lb.id)}
                  onChange={() => toggleLabel(lb.id)}
                />
                <span
                  className="rounded px-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: lb.color }}
                >
                  {lb.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
