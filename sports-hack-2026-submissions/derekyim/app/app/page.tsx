"use client";

import { useState, useRef, useCallback } from "react";

type Step = "pick-mode" | "capture" | "submitting" | "queued";
type Mode = "hype" | "roast";

export default function FanPage() {
  const [step, setStep] = useState<Step>("pick-mode");
  const [mode, setMode] = useState<Mode>("hype");
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickMode = useCallback((picked: Mode | "lucky") => {
    const resolved =
      picked === "lucky"
        ? Math.random() > 0.5
          ? "hype"
          : "roast"
        : picked;
    setMode(resolved);
    setStep("capture");
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        const MAX_W = 512;
        const scale = MAX_W / img.width;
        canvas.width = MAX_W;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL("image/jpeg", 0.8));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!thumbnail || !name.trim()) return;
    setStep("submitting");
    setError(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          name: name.trim(),
          section: section.trim() || "N/A",
          thumbnail,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = await res.json();
      setSubmissionId(data.id);
      setQueuePosition(data.position);
      setStep("queued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("capture");
    }
  }, [thumbnail, name, section, mode]);

  const reset = useCallback(() => {
    setStep("pick-mode");
    setThumbnail(null);
    setName("");
    setSection("");
    setError(null);
    setSubmissionId(null);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl font-black tracking-tight text-center mb-1">
        CELTICS
      </h1>
      <p className="text-xl font-black text-celtics-gold mb-8 tracking-wide">
        GREEN OR MEAN
      </p>

      {step === "pick-mode" && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <p className="text-center text-lg font-medium mb-2">Pick your mode</p>

          <button
            onClick={() => pickMode("hype")}
            className="w-full py-4 px-6 bg-white text-celtics-green font-bold text-xl rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            HYPE ME
          </button>

          <button
            onClick={() => pickMode("roast")}
            className="w-full py-4 px-6 bg-celtics-gold text-black font-bold text-xl rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            ROAST ME
          </button>

          <button
            onClick={() => pickMode("lucky")}
            className="w-full py-4 px-6 bg-celtics-black text-white font-bold text-xl rounded-2xl shadow-lg border-2 border-celtics-gold active:scale-95 transition-transform"
          >
            I&apos;M FEELING LUCKY
          </button>
        </div>
      )}

      {step === "capture" && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={reset}
              className="text-sm underline opacity-80"
            >
              &larr; Back
            </button>
            <span className="text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20">
              {mode === "hype" ? "HYPE" : "ROAST"}
            </span>
          </div>

          {thumbnail ? (
            <div className="relative">
              <img
                src={thumbnail}
                alt="Your selfie"
                className="w-full rounded-2xl shadow-lg"
              />
              <button
                onClick={() => {
                  setThumbnail(null);
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full"
              >
                Retake
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-16 border-4 border-dashed border-white/40 rounded-2xl text-center text-white/80 text-lg font-medium active:scale-95 transition-transform"
            >
              Tap to take a selfie
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileChange}
            className="hidden"
          />

          <input
            type="text"
            placeholder="Your first name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 text-lg font-medium outline-none focus:ring-2 focus:ring-celtics-gold"
          />

          <input
            type="text"
            placeholder="Section (e.g. 312)"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 text-lg font-medium outline-none focus:ring-2 focus:ring-celtics-gold"
          />

          {error && (
            <p className="text-red-300 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!thumbnail || !name.trim()}
            className="w-full py-4 px-6 bg-celtics-gold text-black font-bold text-xl rounded-2xl shadow-lg disabled:opacity-40 active:scale-95 transition-transform"
          >
            SUBMIT
          </button>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-lg font-medium">
            AI is scoring your selfie...
          </p>
        </div>
      )}

      {step === "queued" && (
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="text-6xl">🏀</div>
          <h2 className="text-2xl font-bold">You&apos;re in the queue!</h2>
          <div className="bg-white/20 rounded-2xl px-8 py-4">
            <p className="text-sm opacity-80">Queue position</p>
            <p className="text-5xl font-black">{queuePosition}</p>
          </div>
          <p className="text-sm opacity-70">
            Watch the jumbotron — you might be up next!
          </p>
          <button
            onClick={reset}
            className="text-sm underline opacity-60"
          >
            Submit another
          </button>
        </div>
      )}
    </main>
  );
}
