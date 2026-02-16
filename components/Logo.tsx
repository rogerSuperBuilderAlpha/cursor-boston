import Image from "next/image";

const LOGO_SRC = "/cursor-boston-logo.png";
const ALT = "Cursor Boston";

const sizeClasses = {
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
        className="object-contain"
        priority={priority}
        sizes={
          size === "heroHome"
            ? "(min-width: 768px) 192px, 160px"
            : size === "hero"
              ? "112px"
              : "48px"
        }
      />
    </div>
  );
}
