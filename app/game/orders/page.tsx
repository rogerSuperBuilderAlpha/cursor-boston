/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { QueuedOrder, QueuedOrderKind, UnitType } from "@/lib/game/types";

interface OrdersResponse {
  success: boolean;
  orders?: QueuedOrder[];
  error?: { message?: string } | string;
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<QueuedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeExecuted, setIncludeExecuted] = useState(false);

  // Enqueue form state
  const [kind, setKind] = useState<QueuedOrderKind>("recruit_on_tile");
  const [tileId, setTileId] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("ground");
  const [sourceTileId, setSourceTileId] = useState("");
  const [targetTileId, setTargetTileId] = useState("");
  const [ground, setGround] = useState(0);
  const [siege, setSiege] = useState(0);
  const [air, setAir] = useState(0);
  const [offenseSpellId, setOffenseSpellId] = useState("");
  const [spellId, setSpellId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const url = `/api/game/orders${includeExecuted ? "?includeExecuted=true" : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: OrdersResponse = await res.json();
      if (data.success) {
        setOrders(data.orders ?? []);
        setError(null);
      } else {
        setError(typeof data.error === "string" ? data.error : data.error?.message ?? "Load failed");
      }
    } finally {
      setLoading(false);
    }
  }, [user, includeExecuted]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!authLoading && user) refresh();
  }, [authLoading, user, refresh]);

  const submit = useCallback(async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { kind };
      if (kind === "recruit_on_tile") {
        body.tileId = tileId;
        body.unitType = unitType;
      } else if (kind === "attack_adjacent") {
        body.sourceTileId = sourceTileId;
        body.targetTileId = targetTileId;
        body.units = { ground, siege, air };
        body.offenseSpellId = offenseSpellId || null;
      } else if (kind === "cast_spell_on_tile") {
        body.tileId = tileId;
        body.spellId = spellId;
      }
      const token = await user.getIdToken();
      const res = await fetch("/api/game/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(typeof data.error === "string" ? data.error : data.error?.message ?? "Enqueue failed");
        return;
      }
      setTileId("");
      setSourceTileId("");
      setTargetTileId("");
      setGround(0);
      setSiege(0);
      setAir(0);
      setOffenseSpellId("");
      setSpellId("");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }, [user, kind, tileId, unitType, sourceTileId, targetTileId, ground, siege, air, offenseSpellId, spellId, refresh]);

  const cancel = useCallback(
    async (orderId: string) => {
      if (!user) return;
      const token = await user.getIdToken();
      await fetch(`/api/game/orders?orderId=${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await refresh();
    },
    [user, refresh]
  );

  if (authLoading) {
    return <div className="max-w-4xl mx-auto p-6"><p>Loading…</p></div>;
  }
  if (!user) {
    return <div className="max-w-4xl mx-auto p-6"><p>Please sign in.</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/game/zero-turn" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
          ← Back to Between turns
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Queued orders</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        Plan your next session. Queued orders execute automatically at next
        weekly turn grant, in the order you enqueue them. Each costs its
        normal turn cost when it fires; if turns run out, remaining orders
        are skipped.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 p-3 mb-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 mb-6 bg-white dark:bg-neutral-950">
        <h2 className="font-semibold mb-3">Enqueue a new order</h2>
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="block text-xs uppercase text-neutral-500 mb-1">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as QueuedOrderKind)}
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-sm"
            >
              <option value="recruit_on_tile">Recruit on tile</option>
              <option value="attack_adjacent">Attack adjacent</option>
              <option value="cast_spell_on_tile">Cast spell on tile (not yet supported)</option>
            </select>
          </label>

          {kind === "recruit_on_tile" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={tileId}
                onChange={(e) => setTileId(e.target.value)}
                placeholder="tileId (e.g. q0r0)"
                className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
              />
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType)}
                className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
              >
                <option value="ground">Ground</option>
                <option value="siege">Siege</option>
                <option value="air">Air</option>
              </select>
            </div>
          )}

          {kind === "attack_adjacent" && (
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={sourceTileId} onChange={(e) => setSourceTileId(e.target.value)} placeholder="source tileId" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
              <input type="text" value={targetTileId} onChange={(e) => setTargetTileId(e.target.value)} placeholder="target tileId" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
              <input type="number" value={ground} onChange={(e) => setGround(Math.max(0, parseInt(e.target.value || "0", 10)))} placeholder="ground" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
              <input type="number" value={siege} onChange={(e) => setSiege(Math.max(0, parseInt(e.target.value || "0", 10)))} placeholder="siege" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
              <input type="number" value={air} onChange={(e) => setAir(Math.max(0, parseInt(e.target.value || "0", 10)))} placeholder="air" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
              <input type="text" value={offenseSpellId} onChange={(e) => setOffenseSpellId(e.target.value)} placeholder="offense spell id (optional)" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
            </div>
          )}

          {kind === "cast_spell_on_tile" && (
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={tileId} onChange={(e) => setTileId(e.target.value)} placeholder="tileId" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
              <input type="text" value={spellId} onChange={(e) => setSpellId(e.target.value)} placeholder="spellId" className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900" />
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded text-sm self-start"
          >
            {submitting ? "Enqueueing…" : "Enqueue"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Your queue</h2>
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={includeExecuted} onChange={(e) => setIncludeExecuted(e.target.checked)} />
          Include past
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-neutral-500">No orders queued.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950 flex items-start justify-between gap-4"
            >
              <div>
                <div className="text-sm font-medium">
                  #{o.sequenceIndex + 1} · {o.kind}{" "}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    o.status === "queued" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                    o.status === "executed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                    o.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}>
                    {o.status}
                  </span>
                </div>
                <pre className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 font-mono">
                  {JSON.stringify(o.params)}
                </pre>
                {o.resultSummary && (
                  <p className="text-xs text-neutral-500 mt-1">{o.resultSummary}</p>
                )}
              </div>
              {o.status === "queued" && (
                <button
                  onClick={() => cancel(o.id)}
                  className="text-xs px-2 py-1 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
