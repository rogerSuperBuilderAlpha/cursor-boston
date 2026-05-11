/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import Image from "next/image";

type SizePreset = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: SizePreset | number;
  className?: string;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 60) + 140;
  return `hsl(${hue}, 70%, 45%)`;
}

function getGradient(str: string): string {
  const color1 = stringToColor(str);
  const color2 = stringToColor(str + "secondary");
  return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
}

function getInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmedName[0].toUpperCase();
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail[0].toUpperCase();
  }
  return "?";
}

const presetSizes: Record<SizePreset, { px: number; box: string; text: string }> = {
  sm: { px: 32, box: "w-8 h-8", text: "text-sm" },
  md: { px: 48, box: "w-12 h-12", text: "text-lg" },
  lg: { px: 64, box: "w-16 h-16", text: "text-2xl" },
  xl: { px: 96, box: "w-24 h-24", text: "text-3xl" },
};

function textClassForPx(px: number): string {
  if (px <= 24) return "text-[10px]";
  if (px <= 32) return "text-xs";
  if (px <= 44) return "text-sm";
  if (px <= 60) return "text-lg";
  if (px <= 80) return "text-2xl";
  return "text-3xl";
}

function resolveSize(size: SizePreset | number): {
  px: number;
  boxClass: string;
  textClass: string;
  boxStyle?: { width: number; height: number };
} {
  if (typeof size === "number") {
    return {
      px: size,
      boxClass: "",
      textClass: textClassForPx(size),
      boxStyle: { width: size, height: size },
    };
  }
  const preset = presetSizes[size];
  return { px: preset.px, boxClass: preset.box, textClass: preset.text };
}

export default function Avatar({
  src,
  name,
  email,
  size = "xl",
  className = "",
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { px, boxClass, textClass, boxStyle } = resolveSize(size);
  const identifier = email || name || "user";
  const initials = getInitials(name, email);
  const gradient = getGradient(identifier);

  if (src && !imgError) {
    return (
      <Image
        src={src}
        alt={name || "Profile"}
        width={px}
        height={px}
        className={`rounded-full object-cover ${boxClass} ${className}`.trim()}
        style={boxStyle}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || email || "User avatar"}
      className={`${boxClass} ${textClass} rounded-full flex items-center justify-center font-semibold text-white shadow-inner ${className}`.trim()}
      style={{ ...boxStyle, background: gradient }}
    >
      {initials}
    </div>
  );
}
