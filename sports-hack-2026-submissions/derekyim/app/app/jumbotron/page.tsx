"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Submission {
  id: string;
  mode: "hype" | "roast";
  name: string;
  section: string;
  thumbnail: string;
  composite_score: number;
  vision_description: string | null;
  roast_chosen: string | null;
  roast_candidates: string[];
  status: string;
  dunkinWinner: boolean;
}

export default function JumbotronPage() {
  const [approved, setApproved] = useState<Submission[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchApproved = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions?full=1");
      const data: Submission[] = await res.json();
      setApproved(data.filter((s) => s.status === "approved"));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchApproved();
    const poll = setInterval(fetchApproved, 3000);
    return () => clearInterval(poll);
  }, [fetchApproved]);

  const totalSlides = approved.length + 1;

  useEffect(() => {
    if (cycleTimer.current) clearInterval(cycleTimer.current);

    cycleTimer.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % totalSlides);
        setFade(true);
      }, 400);
    }, 5000);

    return () => {
      if (cycleTimer.current) clearInterval(cycleTimer.current);
    };
  }, [totalSlides]);

  const isQrSlide = currentIdx === 0 || approved.length === 0;

  if (isQrSlide) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-celtics-green/30 via-black to-celtics-green/20" />
        <div
          className={`relative z-10 flex flex-col items-center transition-opacity duration-400 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="text-7xl font-black text-white tracking-tight mb-2">
            CELTICS
          </h1>
          <p className="text-5xl font-black text-celtics-gold tracking-wide mb-10">
            GREEN OR MEAN
          </p>
          <img
            src="/qr.png"
            alt="Scan to submit"
            className="w-64 h-64 rounded-2xl shadow-2xl mb-6 bg-white p-3"
          />
          <p className="text-2xl text-white/50 animate-pulse">
            Scan the QR code to get on the jumbotron!
          </p>
        </div>
      </main>
    );
  }

  const subIdx = currentIdx - 1;
  const current = approved[subIdx % approved.length];
  if (!current) return null;

  const roastText =
    current.roast_chosen || current.roast_candidates[0] || "";

  function seededRandom(seed: string, idx: number) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    h = ((h << 5) - h + idx) | 0;
    return Math.abs(h % 100);
  }

  const fakeStats = {
    energy: seededRandom(current.id, 1),
    celtics: seededRandom(current.id, 2),
    original: seededRandom(current.id, 3),
    safety: 85 + seededRandom(current.id, 4) % 16,
    composite: seededRandom(current.id, 5),
  };

  const isAaron = current.name.toLowerCase().includes("aaron");

  return (
    <main className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-celtics-green/40 via-black to-celtics-green/20" />

      <div
        className={`relative z-10 flex flex-col items-center gap-5 p-8 max-w-4xl w-full transition-opacity duration-400 ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`text-3xl font-black tracking-widest ${
              current.mode === "hype"
                ? "text-celtics-green"
                : "text-celtics-gold"
            }`}
          >
            {current.mode === "hype" ? "GREEN" : "MEAN"}
          </div>
        </div>

        <div className="relative">
          <div
            className={`absolute -inset-2 rounded-3xl blur-xl ${
              current.dunkinWinner
                ? "bg-orange-500/60"
                : current.mode === "hype"
                ? "bg-celtics-green/50"
                : "bg-celtics-gold/50"
            }`}
          />
          <img
            src={current.thumbnail}
            alt={current.name}
            className="relative w-[480px] h-[480px] object-cover rounded-2xl shadow-2xl"
          />
        </div>

        <div className="text-center">
          <div className="text-5xl font-black text-white mb-1">
            {current.name.toUpperCase()}
          </div>
          <div className="text-2xl text-white/60 font-semibold tracking-widest">
            SEC {current.section.toUpperCase()}
          </div>
        </div>

        <div className="flex gap-6 text-lg font-bold text-white/80">
          <span>Energy: <span className="text-celtics-green">{fakeStats.energy}</span></span>
          <span>Celtics: <span className="text-celtics-green">{fakeStats.celtics}</span></span>
          <span>Original: <span className="text-celtics-green">{fakeStats.original}</span></span>
          <span>Safety: <span className="text-celtics-green">{fakeStats.safety}</span></span>
          <span>Composite: <span className="text-celtics-gold text-xl">{fakeStats.composite}</span></span>
        </div>

        {current.mode === "roast" && roastText && (
          <div className="bg-celtics-gold/20 border-2 border-celtics-gold rounded-2xl px-8 py-5 max-w-2xl">
            <p className="text-3xl font-bold text-celtics-gold text-center leading-snug">
              &ldquo;{roastText}&rdquo;
            </p>
          </div>
        )}

        {current.mode === "hype" && (
          <div className="flex gap-4 text-xl font-bold text-white/70">
            <span>ENERGY {fakeStats.composite}</span>
            <span className="text-celtics-green text-3xl">&#9733;</span>
          </div>
        )}

        {(current.dunkinWinner || isAaron) && (
          <div className="bg-orange-500 rounded-2xl px-8 py-4 max-w-2xl animate-bounce">
            <p className="text-2xl font-black text-black text-center">
              CONGRATULATIONS, You won a free Dunkin iced coffee... now wake up
            </p>
          </div>
        )}

        <div className="absolute bottom-4 right-8 flex items-center gap-3">
          <span className="text-sm text-white/20">
            {subIdx + 1} / {approved.length}
          </span>
          <img
            src="/qr.png"
            alt="Scan to submit"
            className="w-16 h-16 rounded-lg bg-white p-1 opacity-70"
          />
        </div>
      </div>
    </main>
  );
}
