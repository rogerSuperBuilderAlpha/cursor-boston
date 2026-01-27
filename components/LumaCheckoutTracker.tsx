"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { registerForEvent } from "@/lib/registrations";

// Event data for tracking
const EVENT_DATA: Record<string, { title: string; date?: string }> = {
  "evt-JygYtduLJkyFgd7": {
    title: "Cursor Ambassadors - Boston at Hult",
    date: "2026-02-01",
  },
};

export default function LumaCheckoutTracker() {
  const { user } = useAuth();

  useEffect(() => {
    // Listen for Luma checkout completion via postMessage
    const handleMessage = async (event: MessageEvent) => {
      // Luma sends messages from lu.ma or luma.com domains
      if (
        !event.origin.includes("lu.ma") &&
        !event.origin.includes("luma.com")
      ) {
        return;
      }

      try {
        const data = event.data;

        // Luma sends various message types - look for checkout completion
        if (
          data?.type === "luma:checkout:complete" ||
          data?.type === "checkout:complete" ||
          data?.event === "checkout_complete" ||
          data?.action === "checkout_complete"
        ) {
          const eventId = data.eventId || data.event_id || data.lumaEventId;
          const guestId = data.guestId || data.guest_id;

          if (eventId && user) {
            const eventInfo = EVENT_DATA[eventId] || {
              title: "Cursor Boston Event",
            };

            await registerForEvent(
              user.uid,
              user.email || "",
              user.displayName || undefined,
              eventId,
              eventInfo.title,
              eventInfo.date,
              guestId
            );

            console.log("Registration tracked for event:", eventId);
          }
        }
      } catch (error) {
        console.error("Error processing Luma checkout message:", error);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [user]);

  // Also track when user clicks the Luma checkout button
  useEffect(() => {
    const trackCheckoutClick = async (e: Event) => {
      const target = e.target as HTMLElement;
      const lumaButton = target.closest("[data-luma-event-id]") as HTMLElement;

      if (lumaButton && user) {
        const eventId = lumaButton.dataset.lumaEventId;
        if (eventId) {
          // Store intent to register - will be confirmed when checkout completes
          sessionStorage.setItem("luma_checkout_intent", JSON.stringify({
            eventId,
            userId: user.uid,
            timestamp: Date.now(),
          }));
        }
      }
    };

    document.addEventListener("click", trackCheckoutClick);
    return () => document.removeEventListener("click", trackCheckoutClick);
  }, [user]);

  return null; // This component doesn't render anything
}
