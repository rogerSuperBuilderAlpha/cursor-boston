import { useRef, useState, type KeyboardEvent, type SVGProps } from "react";
import type { BadgeDefinition, BadgeEligibilityResult } from "@/lib/badges/types";
import { cn } from "@/lib/utils";
import { BadgePopover } from "./BadgePopover";

interface BadgeCardProps {
  definition: BadgeDefinition;
  eligibility?: BadgeEligibilityResult;
  earned?: boolean;
  awardedAt?: string;
  isAuthoritative?: boolean;
  compact?: boolean;
  className?: string;
}

function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
      <path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
    </svg>
  );
}

function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 20" />
    </svg>
  );
}

function MicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v5" />
      <path d="M8 22h8" />
    </svg>
  );
}

function CodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m8 16-4-4 4-4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m14 4-4 16" />
    </svg>
  );
}

function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m12 3 2.9 5.9 6.6 1-4.8 4.7 1.1 6.6L12 18l-5.8 3.2 1.1-6.6-4.8-4.7 6.6-1L12 3Z" />
    </svg>
  );
}

function MessageSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CalendarCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function GraduationCapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m2 10 10-5 10 5-10 5-10-5Z" />
      <path d="M6 12v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4" />
    </svg>
  );
}

function GitPullRequestIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M6 9v9" />
      <path d="M18 15V9a3 3 0 0 0-3-3H9" />
    </svg>
  );
}

function FallbackAwardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="8" r="5" />
      <path d="m8.5 13.5-2 7 5.5-2.5 5.5 2.5-2-7" />
    </svg>
  );
}

function BadgeIcon({
  iconKey,
  ...props
}: { iconKey?: string } & SVGProps<SVGSVGElement>) {
  switch (iconKey) {
    case "sparkles":
      return <SparklesIcon {...props} />;
    case "link":
      return <LinkIcon {...props} />;
    case "mic":
      return <MicIcon {...props} />;
    case "code":
      return <CodeIcon {...props} />;
    case "star":
      return <StarIcon {...props} />;
    case "message-square":
      return <MessageSquareIcon {...props} />;
    case "calendar-check":
      return <CalendarCheckIcon {...props} />;
    case "graduation-cap":
      return <GraduationCapIcon {...props} />;
    case "git-pull-request":
      return <GitPullRequestIcon {...props} />;
    default:
      return <FallbackAwardIcon {...props} />;
  }
}

export function BadgeCard({
  definition,
  eligibility,
  earned,
  awardedAt,
  isAuthoritative = true,
  compact = false,
  className,
}: BadgeCardProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const isEarned = earned ?? eligibility?.isEligible ?? false;
  const showcaseApprovalNote =
    definition.id === "showcase-star" && isEarned
      ? "Showcase Star is only awarded after at least one showcase submission is approved."
      : undefined;
  const statusText = isEarned
    ? "Earned"
    : isAuthoritative
    ? eligibility?.reason || "Not earned yet"
    : "Badge data is partially unavailable. Some badge statuses may be unverified.";
  const earnedDate = awardedAt ? new Date(awardedAt) : null;
  const earnedDateLabel =
    isEarned && earnedDate && !Number.isNaN(earnedDate.getTime())
      ? earnedDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsPopoverOpen(true);
    }
  };

  const closePopover = () => {
    setIsPopoverOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  return (
    <>
      <article
        ref={triggerRef}
        className={cn(
          "rounded-xl border transition-colors cursor-pointer",
          "bg-white dark:bg-neutral-900",
          isEarned
            ? "border-emerald-300/70 dark:border-emerald-500/40"
            : "border-neutral-200 dark:border-neutral-800",
          !compact && "hover:border-neutral-300 dark:hover:border-neutral-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
          compact ? "p-3" : "p-4",
          className
        )}
        aria-label={definition.name}
        aria-haspopup="dialog"
        aria-expanded={isPopoverOpen}
        role="button"
        tabIndex={0}
        onClick={() => setIsPopoverOpen(true)}
        onKeyDown={handleKeyDown}
      >
        <div className={cn("flex items-start", compact ? "gap-3" : "gap-4")}>
          <div
            className={cn(
              "shrink-0 rounded-full border flex items-center justify-center",
              compact ? "h-9 w-9" : "h-11 w-11",
              isEarned
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400"
            )}
          >
            <BadgeIcon
              iconKey={definition.iconKey}
              width={compact ? 16 : 18}
              height={compact ? 16 : 18}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className={cn(
                  "font-semibold text-foreground truncate",
                  compact ? "text-sm" : "text-base"
                )}
              >
                {definition.name}
              </h3>
              <span
                className={cn(
                  "shrink-0 px-2 py-0.5 rounded-full text-xs font-medium",
                  isEarned
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                )}
              >
                {isEarned ? "Earned" : isAuthoritative ? "Locked" : "Unverified data"}
              </span>
            </div>

            <p
              className={cn(
                "text-neutral-600 dark:text-neutral-400",
                compact ? "text-xs" : "text-sm"
              )}
            >
              {definition.description}
            </p>

            {!isEarned && (
              <p
                className={cn(
                  "text-neutral-500 dark:text-neutral-400 mt-1",
                  compact ? "text-xs" : "text-sm"
                )}
              >
                {statusText}
              </p>
            )}

            {isEarned && earnedDateLabel && (
              <p
                className={cn(
                  "text-neutral-500 dark:text-neutral-400 mt-1",
                  compact ? "text-xs" : "text-sm"
                )}
              >
                Earned {earnedDateLabel}
              </p>
            )}

            {eligibility?.progress && (
              <div className={cn("mt-2", compact ? "text-xs" : "text-sm")}>
                <p className="text-neutral-500 dark:text-neutral-400 mb-1">
                  Progress: {eligibility.progress.current}/{eligibility.progress.target}
                  {eligibility.progress.unit ? ` ${eligibility.progress.unit}` : ""}
                </p>
                <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isEarned ? "bg-emerald-500" : "bg-neutral-500 dark:bg-neutral-500"
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        (eligibility.progress.current / eligibility.progress.target) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <p
              className={cn(
                "mt-2 text-neutral-500 dark:text-neutral-400",
                compact ? "text-[11px]" : "text-xs"
              )}
            >
              Click for details
            </p>
          </div>
        </div>
      </article>

      <BadgePopover
        definition={definition}
        eligibility={eligibility}
        isOpen={isPopoverOpen}
        onClose={closePopover}
        showcaseApprovalNote={showcaseApprovalNote}
      />
    </>
  );
}
