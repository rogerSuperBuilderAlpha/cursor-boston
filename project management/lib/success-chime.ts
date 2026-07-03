const STORAGE_KEY = "milestone-sound-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function playSuccessChime(): void {
  if (typeof window === "undefined" || !isSoundEnabled()) {
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const now = context.currentTime;

  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  master.connect(context.destination);

  const tones = [
    { frequency: 880, start: 0, duration: 0.18 },
    { frequency: 1174.66, start: 0.11, duration: 0.28 },
    { frequency: 1567.98, start: 0.24, duration: 0.42 },
  ];

  for (const tone of tones) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, now + tone.start);

    gain.gain.setValueAtTime(0.0001, now + tone.start);
    gain.gain.exponentialRampToValueAtTime(0.35, now + tone.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now + tone.start);
    oscillator.stop(now + tone.start + tone.duration + 0.05);
  }

  window.setTimeout(() => {
    void context.close();
  }, 1200);
}
