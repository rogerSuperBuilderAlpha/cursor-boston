/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Flame,
  MessageCircle,
  Radio,
  Shield,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";

type TeamKey = "celtics" | "knicks";

type Team = {
  key: TeamKey;
  name: string;
  short: string;
  city: string;
  score: number;
  record: string;
  color: string;
  secondary: string;
  logo: string;
};

type Play = {
  id: number;
  quarter: string;
  clock: string;
  team: TeamKey;
  title: string;
  detail: string;
};

type Commentary = {
  commentary: string;
  sentiment: "glaze" | "roast" | "neutral";
  crowdEnergy: number;
};

const teams: Record<TeamKey, Team> = {
  celtics: {
    key: "celtics",
    name: "Boston Celtics",
    short: "Celtics",
    city: "Boston",
    score: 112,
    record: "64-18",
    color: "#007A33",
    secondary: "#BA9653",
    logo: "https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg",
  },
  knicks: {
    key: "knicks",
    name: "New York Knicks",
    short: "Knicks",
    city: "New York",
    score: 103,
    record: "50-32",
    color: "#006BB6",
    secondary: "#F58426",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/25/New_York_Knicks_logo.svg",
  },
};

const plays: Play[] = [
  {
    id: 1,
    quarter: "Q4",
    clock: "2:14",
    team: "celtics",
    title: "Tatum buries a step-back three from the wing.",
    detail: "Boston stretches the lead and the Garden noise jumps again.",
  },
  {
    id: 2,
    quarter: "Q4",
    clock: "1:47",
    team: "knicks",
    title: "Brunson drives hard but Horford forces the miss.",
    detail: "New York comes up empty on a huge possession.",
  },
  {
    id: 3,
    quarter: "Q4",
    clock: "1:21",
    team: "celtics",
    title: "White jumps the passing lane and throws it ahead.",
    detail: "Holiday finishes through contact to keep Boston rolling.",
  },
  {
    id: 4,
    quarter: "Q4",
    clock: "0:58",
    team: "knicks",
    title: "Knicks call timeout after another rough offensive set.",
    detail: "The Celtics crowd is standing and the pressure is loud.",
  },
];

const fallbackCommentary: Record<TeamKey, Record<TeamKey, string[]>> = {
  celtics: {
    celtics: [
      "Boston is playing with main character energy right now. Every pass looks like it came with a tracking number.",
      "The Celtics are cooking so cleanly the scoreboard might need a smoke detector.",
      "That was pure green-light basketball. The Knicks are chasing shadows out there.",
    ],
    knicks: [
      "New York's defense just looked decorative. Beautiful color scheme, zero resistance.",
      "The Knicks possession had the structure of a group project five minutes before deadline.",
      "Boston just sent that shot attempt straight to spam.",
    ],
  },
  knicks: {
    celtics: [
      "Boston got away with one there. The Celtics looked calm, but that was not exactly masterpiece material.",
      "The Knicks made that possession awkward enough to make Boston blink.",
      "Celtics fans can exhale, because that sequence was wobbling.",
    ],
    knicks: [
      "New York needed that bucket badly. Brunson just put the whole offense on his back for a second.",
      "That was a tough Knicks play. Not pretty, but definitely alive.",
      "The Knicks punched back there, and suddenly this game has teeth again.",
    ],
  },
};

function getOpponent(team: TeamKey): TeamKey {
  return team === "celtics" ? "knicks" : "celtics";
}

async function requestCommentary(
  play: Play,
  selectedTeam: TeamKey,
): Promise<Commentary> {
  const targetTeam = teams[getOpponent(selectedTeam)].short;
  const fallbackList = fallbackCommentary[selectedTeam][play.team];
  const fallback =
    fallbackList[Math.floor(Math.random() * fallbackList.length)] ??
    "TrashTalk is warming up the mic.";

  try {
    const response = await fetch("/api/commentary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: play.title,
        homeTeam: teams.celtics.short,
        targetTeam,
        mode: play.team === selectedTeam ? "glaze" : "roast",
        intensity: "savage but clean",
        persona: `${teams[selectedTeam].city} superfan`,
      }),
    });

    if (!response.ok) {
      throw new Error("Commentary request failed");
    }

    return response.json();
  } catch {
    return {
      commentary: fallback,
      sentiment: play.team === selectedTeam ? "glaze" : "roast",
      crowdEnergy: play.team === selectedTeam ? 94 : 87,
    };
  }
}

function TeamPanel({
  team,
  selected,
  onSelect,
}: {
  team: Team;
  selected: boolean;
  onSelect: (team: TeamKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(team.key)}
      className="group relative flex min-h-[390px] flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-left shadow-2xl transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      style={{
        boxShadow: selected
          ? `0 0 0 1px ${team.color}, 0 0 70px ${team.color}88`
          : `0 0 46px ${team.color}44`,
      }}
      aria-label={`Choose ${team.name}`}
    >
      <div
        className="absolute inset-0 opacity-70 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 50% 20%, ${team.color}55, transparent 42%), linear-gradient(150deg, ${team.color}2e, ${team.secondary}24, transparent 70%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 to-transparent" />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-between gap-6">
        <div className="flex w-full items-center justify-between gap-4">
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-black uppercase tracking-[0.28em] text-white/80">
            {team.record}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-black"
            style={{ backgroundColor: team.secondary }}
          >
            Live
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Image
            src={team.logo}
            alt={`${team.name} logo`}
            width={224}
            height={224}
            className="h-44 w-44 object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.65)] transition duration-300 group-hover:scale-110 sm:h-56 sm:w-56"
          />
        </div>
        <div className="w-full">
          <p className="text-sm font-bold uppercase tracking-[0.32em] text-white/55">
            {team.city}
          </p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase leading-none text-white sm:text-5xl">
              {team.short}
            </h2>
            <span className="text-5xl font-black leading-none text-white">
              {team.score}
            </span>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-black">
            <Shield className="h-4 w-4" />
            Back {team.short}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function TrashTalkDemo() {
  const [selectedTeam, setSelectedTeam] = useState<TeamKey | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [feed, setFeed] = useState<Array<Play & Commentary>>([]);
  const activePlay = plays[playIndex];

  const selected = selectedTeam ? teams[selectedTeam] : teams.celtics;
  const opponent = selectedTeam ? teams[getOpponent(selectedTeam)] : teams.knicks;

  const energy = useMemo(() => {
    if (!feed[0]) {
      return 91;
    }

    return feed[0].crowdEnergy;
  }, [feed]);

  useEffect(() => {
    if (!selectedTeam) {
      return;
    }

    let cancelled = false;

    async function addPlay(play: Play) {
      const ai = await requestCommentary(play, selectedTeam as TeamKey);

      if (!cancelled) {
        setFeed((current) => [{ ...play, ...ai }, ...current].slice(0, 5));
      }
    }

    addPlay(activePlay);
    const timer = window.setInterval(() => {
      setPlayIndex((current) => (current + 1) % plays.length);
    }, 4200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePlay, selectedTeam]);

  function chooseTeam(team: TeamKey) {
    setSelectedTeam(team);
    setFeed([]);
    setPlayIndex(0);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,122,51,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,132,38,0.2),transparent_32%),linear-gradient(180deg,#050507,#0c0c12_48%,#050507)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff3131] shadow-[0_0_35px_rgba(255,49,49,0.65)]">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.36em] text-[#ff7a00]">
                  Live sports AI
                </p>
                <h1 className="text-4xl font-black uppercase leading-none tracking-normal sm:text-5xl">
                  TrashTalk
                </h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-red-100 shadow-[0_0_28px_rgba(255,49,49,0.25)]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" />
            Live Q4 2:14
          </div>
        </header>

        <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-3 px-2">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.32em] text-white/45">
                    Featured matchup
                  </p>
                  <h2 className="mt-1 text-2xl font-black uppercase text-white sm:text-3xl">
                    Celtics vs Knicks
                  </h2>
                </div>
                <div className="hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/80 sm:flex">
                  <Trophy className="h-4 w-4 text-[#BA9653]" />
                  Playoff energy
                </div>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row">
                <TeamPanel
                  team={teams.celtics}
                  selected={selectedTeam === "celtics"}
                  onSelect={chooseTeam}
                />
                <div className="flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/70 text-xl font-black uppercase shadow-[0_0_40px_rgba(255,255,255,0.18)] lg:h-20 lg:w-20">
                    VS
                  </div>
                </div>
                <TeamPanel
                  team={teams.knicks}
                  selected={selectedTeam === "knicks"}
                  onSelect={chooseTeam}
                />
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-[#101018]/90 p-5 shadow-2xl backdrop-blur">
            {!selectedTeam ? (
              <div className="flex min-h-[560px] flex-col justify-between">
                <div>
                  <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70">
                    <Zap className="h-4 w-4 text-[#00d4ff]" />
                    Choose a side to start the chaos
                  </div>
                  <h2 className="text-5xl font-black uppercase leading-[0.92] tracking-normal sm:text-6xl">
                    Pick your team. Start the noise.
                  </h2>
                  <p className="mt-5 max-w-md text-lg leading-7 text-white/62">
                    Tap Celtics for the demo. TrashTalk will glaze Boston plays,
                    roast New York mistakes, and keep the feed moving like a
                    live broadcast.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Biased AI", "Live feed", "Savage mode"].map((label) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-white/45">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="min-h-[560px]">
                <div
                  className="rounded-3xl border p-5"
                  style={{
                    borderColor: `${selected.color}66`,
                    background: `linear-gradient(140deg, ${selected.color}22, rgba(255,255,255,0.04), ${opponent.color}18)`,
                    boxShadow: `0 0 55px ${selected.color}33`,
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">
                        You backed
                      </p>
                      <h2 className="mt-1 text-3xl font-black uppercase">
                        {selected.name}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTeam(null)}
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/75 hover:bg-white/15"
                    >
                      Switch
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-black/35 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        Score
                      </p>
                      <p className="mt-1 text-3xl font-black">
                        {teams.celtics.score}-{teams.knicks.score}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/35 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        Roast
                      </p>
                      <p className="mt-1 text-2xl font-black">Savage</p>
                    </div>
                    <div className="rounded-2xl bg-black/35 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        Energy
                      </p>
                      <p className="mt-1 text-3xl font-black">{energy}%</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 animate-pulse text-red-400" />
                    <h3 className="text-lg font-black uppercase tracking-[0.18em]">
                      Live feed
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-white/55">
                    <Activity className="h-4 w-4" />
                    Auto-updating
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {feed.map((item) => {
                    const isGlaze = item.sentiment === "glaze";
                    const team = teams[item.team];

                    return (
                      <article
                        key={`${item.id}-${item.commentary}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-xl"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Image
                              src={team.logo}
                              alt=""
                              width={32}
                              height={32}
                              className="h-8 w-8 object-contain"
                            />
                            <div>
                              <p className="text-sm font-black text-white">
                                {item.title}
                              </p>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                                {item.quarter} - {item.clock}
                              </p>
                            </div>
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em]"
                            style={{
                              backgroundColor: isGlaze
                                ? `${selected.color}44`
                                : `${opponent.secondary}44`,
                              color: isGlaze ? "#b8ffd7" : "#ffd2a6",
                            }}
                          >
                            {isGlaze ? "Glaze" : "Roast"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-black/35 p-4">
                          <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-white/45">
                            {isGlaze ? (
                              <Sparkles className="h-4 w-4 text-emerald-300" />
                            ) : (
                              <MessageCircle className="h-4 w-4 text-orange-300" />
                            )}
                            TrashTalk AI
                          </div>
                          <p className="text-lg font-bold leading-7 text-white">
                            {item.commentary}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
