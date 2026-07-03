"use client";

import { useCallback, useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/success-chime";

export function useSoundPreference() {
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? true : isSoundEnabled(),
  );

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      setSoundEnabled(next);
      return next;
    });
  }, []);

  return { soundEnabled: enabled, toggleSound: toggle };
}
