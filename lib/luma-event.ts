/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Event } from "@/types/events";

/** Returns the preferred luma event ID for a checkout flow. 
 * 
 * This function prioritizes the specific `lumaCheckoutEventId`. 
 * If that valude is null or undefined, it falls back to the generic 'lumaEventId'.
 * @param {Pick<Event, "lumaEventId" | "lumaCheckoutEventId">} event - The event object containing Luma IDs.
 * @param {string} [event.lumaCheckoutEventId] - The specific checkout ID (primary choice).
 * @param {string} event.lumaEventId - The generic event ID (fallback choice).
 * @returns {string} The resolved Luma event ID.
 *
 * @example
 * // Returns "chk-123"
 * getLumaCheckoutEventId({ 
 * lumaCheckoutEventId: "chk-123", 
 * lumaEventId: "evt-999" 
 * });
 *
 * @example
 * // Returns "evt-999"
 * getLumaCheckoutEventId({ 
 * lumaEventId: "evt-999" 
 * });
 */

export function getLumaCheckoutEventId(
  event: Pick<Event, "lumaEventId" | "lumaCheckoutEventId">
): string {
  return event.lumaCheckoutEventId ?? event.lumaEventId;
}

/** Determines the appropirate Luma checkout URL for a given event.
 * This fucntion building a direct checkout link using the `lumaCheckoutEventId`.
 * If that ID is not provided or is falsy, it falls back to returining the general 'lumaUrl'. 
 *  @param {Pick<Event, "lumaUrl" | "lumaCheckoutEventId">} event - The event object containing Luma properties.
 * @param {string} [event.lumaCheckoutEventId] - The specific ID used to construct the Luma checkout link.
 * @param {string} event.lumaUrl - The fallback URL to use if the checkout ID is missing.
 * @returns {string} The constructed Luma checkout URL, or the fallback `lumaUrl`.
 * * @example
 * // Returns "https://luma.com/event/evt-123"
 * getLumaCheckoutHref({ 
 * lumaCheckoutEventId: "evt-123", 
 * lumaUrl: "https://lu.ma/some-other-link" 
 * });
 * * @example
 * // Returns "https://lu.ma/some-other-link"
 * getLumaCheckoutHref({ 
 * lumaUrl: "https://lu.ma/some-other-link" 
 * });
 * 
*/
export function getLumaCheckoutHref(
  event: Pick<Event, "lumaUrl" | "lumaCheckoutEventId">
): string {
  if (event.lumaCheckoutEventId) {
    return `https://luma.com/event/${event.lumaCheckoutEventId}`;
  }
  return event.lumaUrl;
}
