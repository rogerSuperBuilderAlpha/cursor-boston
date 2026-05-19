/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

type LumaEmbedProps = {
  embedId: string;
  title: string;
  className?: string;
  /** Override the default aspect box (4:3) if you need a taller frame. */
  aspect?: "video" | "square" | "portrait";
};

const ASPECT_CLASS: Record<NonNullable<LumaEmbedProps["aspect"]>, string> = {
  video: "aspect-video",
  square: "aspect-square",
  portrait: "aspect-[3/4]",
};

/** Renders a luma event checkout embed within an iframe . 
 * 
 * **Luma API and Embed context:**
 *  - Event ID Format : Expects a standard Luma event ID string (eg 'evt-xxxxxxxx').
 *  - Rate limits and caching: Bcause this is a clinet-side iframe, luma API rate limits apply to the invdidual user's IP,
 *    not the host server. No server-side caching is required for this component. 
 *  - Fallback Behavior: If the Luma API is down, or the `embedId` points to a deleted/invalid event, 
 *    the iframe acts as an isolated sandbox. It will gracefully display Luma's internal "Event not found" or 404 state without crashing the host application.
 *
 * @param {LumaEmbedProps} props - The properties for the LumaEmbed component.
 * @param {string} props.embedId - The specific Luma Event ID to render.
 * @param {string} props.title - Accessibility title for the iframe element.
 * @param {string} [props.className] - Optional Tailwind CSS classes for the wrapper div.
 * @param {"video" | "square" | "portrait"} [props.aspect="square"] - Defines the aspect ratio of the embed container.
 * * @example
 * // Standard square embed for a hackathon
 * <LumaEmbed 
 * embedId="evt-123456789" 
 * title="Hackathon Registration" 
 * />
 *
 * @example
 * // Portrait embed with custom shadow and margin
 * <LumaEmbed 
 * embedId="evt-987654321" 
 * title="Workshop Checkout" 
 * aspect="portrait" 
 * className="shadow-lg mt-4" 
 * />
 */

export function LumaEmbed({
  embedId,
  title,
  className = "",
  aspect = "square",
}: LumaEmbedProps) {
  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      <iframe
        src={`https://luma.com/embed/event/${embedId}/simple`}
        title={title}
        className={`block w-full ${ASPECT_CLASS[aspect]}`}
        allow="fullscreen; payment"
        loading="lazy"
      />
    </div>
  );
}
