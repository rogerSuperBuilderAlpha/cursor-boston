"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Board, Card, Column, Label } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";

function SortableCardItem({
  card,
  labelById,
  memberName,
  onOpen,
}: {
  card: Card;
  labelById: Map<string, Label>;
  memberName: (uid: string | null) => string | null;
  onOpen: (c: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("mb-2", isDragging && "opacity-40")}>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/90 shadow-sm hover:border-zinc-600">
        <div className="flex gap-1 p-2">
          <button
            type="button"
            className="touch-none cursor-grab rounded p-1 text-zinc-500 hover:bg-zinc-800 active:cursor-grabbing"
            aria-label="Drag card"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpen(card)}
          >
            <p className="text-sm font-medium text-zinc-100">{card.title}</p>
            {card.assigneeId ? (
              <p className="mt-1 text-xs text-zinc-500">
                @{memberName(card.assigneeId) ?? card.assigneeId}
              </p>
            ) : null}
            {card.labelIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {card.labelIds.map((lid) => {
                  const lb = labelById.get(lid);
                  if (!lb) return null;
                  return (
                    <span
                      key={lid}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: lb.color }}
                    >
                      {lb.name}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColumnContainer({
  column,
  children,
}: {
  column: Column;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });
  return (
    <div className="flex h-full min-h-[220px] flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-3 py-2">
        <h3 className="text-sm font-semibold text-zinc-200">{column.title}</h3>
      </div>
      <div ref={setNodeRef} className="min-h-[120px] flex-1 overflow-y-auto px-2 py-2">
        {children}
      </div>
    </div>
  );
}

export function BoardView({
  boardId,
  board,
  columns,
  cards,
  labels,
  members,
  onRefresh,
  onAddCard,
  onOpenCard,
}: {
  boardId: string;
  board: Board;
  columns: Column[];
  cards: Card[];
  labels: Label[];
  members: { uid: string; displayName: string | null; photoUrl: string | null }[];
  onRefresh: () => Promise<void>;
  onAddCard: (columnId: string) => void;
  onOpenCard: (card: Card) => void;
}) {
  const api = useApi();

  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const memberName = useCallback(
    (uid: string | null) => {
      if (!uid) return null;
      return members.find((m) => m.uid === uid)?.displayName ?? null;
    },
    [members],
  );

  const columnOrder = board.columnOrder.length
    ? board.columnOrder
    : [...columns].sort((a, b) => a.position - b.position).map((c) => c.id);

  const [items, setItems] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const m: Record<string, string[]> = {};
    for (const cid of columnOrder) {
      m[cid] = [];
    }
    for (const c of cards) {
      if (!m[c.columnId]) m[c.columnId] = [];
    }
    for (const c of cards) {
      m[c.columnId].push(c.id);
    }
    for (const k of Object.keys(m)) {
      const meta = cards.filter((c) => m[k].includes(c.id));
      meta.sort((a, b) => a.position - b.position);
      m[k] = meta.map((c) => c.id);
    }
    setItems(m);
  }, [cards, columnOrder]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const findContainer = useCallback(
    (id: string) => {
      if (Object.prototype.hasOwnProperty.call(items, id)) return id;
      return Object.keys(items).find((key) => items[key]?.includes(id)) ?? null;
    },
    [items],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const persistLayout = useCallback(
    async (next: Record<string, string[]>) => {
      const flat: { id: string; columnId: string; position: number }[] = [];
      for (const colId of columnOrder) {
        const ids = next[colId] ?? [];
        ids.forEach((cardId, position) => {
          flat.push({ id: cardId, columnId: colId, position });
        });
      }
      const res = await api(`/api/boards/${boardId}/layout`, {
        method: "PATCH",
        body: JSON.stringify({ cards: flat }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Layout save failed");
      }
      await onRefresh();
    },
    [api, boardId, columnOrder, onRefresh],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeContainer = findContainer(String(active.id));
      let overContainer = findContainer(String(over.id));
      if (!overContainer && Object.prototype.hasOwnProperty.call(items, String(over.id))) {
        overContainer = String(over.id);
      }
      if (!activeContainer || !overContainer) return;

      if (activeContainer === overContainer) {
        setItems((prev) => {
          const list = [...(prev[activeContainer] ?? [])];
          const oldIndex = list.indexOf(String(active.id));
          const newIndex = list.indexOf(String(over.id));
          if (oldIndex < 0 || newIndex < 0) return prev;
          const nextList = arrayMove(list, oldIndex, newIndex);
          const next = { ...prev, [activeContainer]: nextList };
          void persistLayout(next).catch(() => {});
          return next;
        });
        return;
      }

      setItems((prev) => {
        const aItems = [...(prev[activeContainer] ?? [])];
        const bItems = [...(prev[overContainer] ?? [])];
        const activeIndex = aItems.indexOf(String(active.id));
        if (activeIndex < 0) return prev;
        const [removed] = aItems.splice(activeIndex, 1);
        const overIdStr = String(over.id);
        if (Object.prototype.hasOwnProperty.call(prev, overIdStr)) {
          bItems.push(removed);
        } else {
          const overIndex = bItems.indexOf(overIdStr);
          if (overIndex >= 0) {
            bItems.splice(overIndex, 0, removed);
          } else {
            bItems.push(removed);
          }
        }
        const next = { ...prev, [activeContainer]: aItems, [overContainer]: bItems };
        void persistLayout(next).catch(() => {});
        return next;
      });
    },
    [findContainer, items, persistLayout],
  );

  const activeCard = activeId ? cardById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnOrder.map((colId) => {
          const col = columns.find((c) => c.id === colId);
          if (!col) return null;
          const ids = items[colId] ?? [];
          return (
            <div key={colId} className="w-72 shrink-0">
              <ColumnContainer column={col}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const c = cardById.get(id);
                    if (!c) return null;
                    return (
                      <SortableCardItem
                        key={id}
                        card={c}
                        labelById={labelById}
                        memberName={memberName}
                        onOpen={onOpenCard}
                      />
                    );
                  })}
                </SortableContext>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full justify-start text-zinc-500"
                  onClick={() => onAddCard(colId)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add card
                </Button>
              </ColumnContainer>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-64 rounded-lg border border-emerald-600/50 bg-zinc-900 p-3 shadow-xl">
            <p className="text-sm font-medium text-zinc-100">{activeCard.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
