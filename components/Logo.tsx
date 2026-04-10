/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Image from "next/image";

const LOGO_SRC = "/cursor-boston-logo.png";
const ALT = "Cursor Boston";

const sizeClasses = {
  sm: "w-8 h-8",
  header: "w-12 h-12",
  footer: "w-12 h-12",
  hero: "w-28 h-28",
  heroHome: "w-40 h-40 md:w-48 md:h-48",
} as const;

export type LogoSize = keyof typeof sizeClasses;

type LogoProps = {
  size: LogoSize;
  className?: string;
  priority?: boolean;
};

export default function Logo({ size, className = "", priority = false }: LogoProps) {
  const dimensionClasses = sizeClasses[size];

  return (
    <div className={`relative ${dimensionClasses} ${className}`.trim()}>
      <Image
        src={LOGO_SRC}
        alt={ALT}
        fill
        className="object-contain dark:brightness-100 brightness-0"
        priority={priority}
        sizes={
          size === "heroHome"
            ? "(min-width: 768px) 192px, 160px"
            : size === "hero"
              ? "112px"
              : size === "sm"
                ? "32px"
                : "48px"
        }
      />
    </div>
  );
}
