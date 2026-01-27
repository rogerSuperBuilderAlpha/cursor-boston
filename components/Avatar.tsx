"use client";

import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Generate a consistent color based on a string
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate vibrant colors in the emerald/teal/cyan range
  const hue = Math.abs(hash % 60) + 140; // 140-200 range (cyan to green)
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
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-2xl",
  xl: "w-24 h-24 text-3xl",
};

const imageSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export default function Avatar({
  src,
  name,
  email,
  size = "xl",
  className = "",
}: AvatarProps) {
  const identifier = email || name || "user";
  const initials = getInitials(name, email);
  const gradient = getGradient(identifier);

  if (src) {
    return (
      <Image
        src={src}
        alt={name || "Profile"}
        width={imageSizes[size]}
        height={imageSizes[size]}
        className={`rounded-full object-cover ${sizeClasses[size].split(" ").slice(0, 2).join(" ")} ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white shadow-inner ${className}`}
      style={{ background: gradient }}
    >
      {initials}
    </div>
  );
}
