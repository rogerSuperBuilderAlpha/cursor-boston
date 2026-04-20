/**
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
