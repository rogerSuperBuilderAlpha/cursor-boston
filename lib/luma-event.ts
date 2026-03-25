import type { Event } from "@/types/events";

/** Id passed to Luma checkout (`data-luma-event-id`). */
export function getLumaCheckoutEventId(
  event: Pick<Event, "lumaEventId" | "lumaCheckoutEventId">
): string {
  return event.lumaCheckoutEventId ?? event.lumaEventId;
}

/** Fallback href for the checkout anchor when `evt-…` id is known. */
export function getLumaCheckoutHref(
  event: Pick<Event, "lumaUrl" | "lumaCheckoutEventId">
): string {
  if (event.lumaCheckoutEventId) {
    return `https://luma.com/event/${event.lumaCheckoutEventId}`;
  }
  return event.lumaUrl;
}
