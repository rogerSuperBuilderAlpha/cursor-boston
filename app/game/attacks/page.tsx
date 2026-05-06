/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { GameAttack } from "@/lib/game/types";

interface AttacksResponse {
  success: boolean;
  attacks?: GameAttack[];
  error?: { message?: string; code?: string } | string;
}

type Side = "all" | "sent" | "received";

export default function AttackLogPage() {
  const { user, loading: authLoading } = useAuth();
  const [attacks, setAttacks] = useState<GameAttack[]>([]);
  const [side, setSide] = useState<Side>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (s: Side) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/game/attacks?side=${s}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as AttacksResponse;
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Failed to load";
          throw new Error(msg);
        }
        setAttacks(data.attacks ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    refresh(side);
  }, [authLoading, side, refresh]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/login" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Attack log</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
          <p>
            Every attack you launched (<em>sent</em>) or received (<em>received</em>).
            Each row shows the units sent, the outcome (captured / repelled /
            stalemate), and casualties on both sides.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {(["all", "sent", "received"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize border ${
                side === s
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {attacks.length === 0 ? (
          <p className="text-center text-neutral-500 py-12">
            No attacks yet.
          </p>
        ) : (
          <div className="space-y-3">
            {attacks.map((a) => (
              <AttackRow key={a.id} attack={a} myUserId={user.uid} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttackRow({ attack, myUserId }: { attack: GameAttack; myUserId: string }) {
  const iAttacked = attack.attackerId === myUserId;
  const outcomeColor =
    attack.outcome === "captured"
      ? "text-emerald-600 dark:text-emerald-400"
      : attack.outcome === "repelled"
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-500";

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-semibold">
          {iAttacked ? "You attacked" : "You were attacked"}
        </span>
        <span className={`text-sm capitalize font-mono ${outcomeColor}`}>
          {attack.outcome}
        </span>
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        Target: <span className="font-mono">{attack.targetTileId}</span>
        {" · "}
        Sent: G{attack.unitsSent.ground} S{attack.unitsSent.siege} A{attack.unitsSent.air}
        {attack.offenseSpellId && ` · ${attack.offenseSpellId}`}
      </div>
      <div className="text-xs text-neutral-500 mt-1">
        Losses — attacker: G{attack.unitsLostAttacker.ground} S{attack.unitsLostAttacker.siege} A{attack.unitsLostAttacker.air}
        {" / "}
        defender: G{attack.unitsLostDefender.ground} S{attack.unitsLostDefender.siege} A{attack.unitsLostDefender.air}
      </div>
    </div>
  );
}
