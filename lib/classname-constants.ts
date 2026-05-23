/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

type ClassNameTree = {
  readonly [key: string]: string | ClassNameTree;
};

export const TAILWIND_CLASS_NAMES = {
  layout: {
    absolute: "absolute",
    block: "block",
    flex: "flex",
    flex1: "flex-1",
    flexCol: "flex-col",
    flexWrap: "flex-wrap",
    grid: "grid",
    hFull: "h-full",
    inlineBlock: "inline-block",
    inlineFlex: "inline-flex",
    inset0: "inset-0",
    itemsCenter: "items-center",
    itemsStart: "items-start",
    justifyBetween: "justify-between",
    justifyCenter: "justify-center",
    minW0: "min-w-0",
    overflowHidden: "overflow-hidden",
    relative: "relative",
    shrink0: "shrink-0",
    srOnly: "sr-only",
    truncate: "truncate",
    wFull: "w-full",
  },
  spacing: {
    gap1: "gap-1",
    gap2: "gap-2",
    gap3: "gap-3",
    gap4: "gap-4",
    mb1: "mb-1",
    mb2: "mb-2",
    mb4: "mb-4",
    mlAuto: "ml-auto",
    mt1: "mt-1",
    mt2: "mt-2",
    mt3: "mt-3",
    p1: "p-1",
    p2: "p-2",
    p3: "p-3",
    p4: "p-4",
    p6: "p-6",
    px2: "px-2",
    px3: "px-3",
    px4: "px-4",
    py05: "py-0.5",
    py1: "py-1",
    py2: "py-2",
    py3: "py-3",
  },
  radius: {
    full: "rounded-full",
    lg: "rounded-lg",
    md: "rounded-md",
    plain: "rounded",
    xl: "rounded-xl",
    twoXl: "rounded-2xl",
  },
  border: {
    base: "border",
    bottomNeutral: "border-b border-neutral-200 dark:border-neutral-800",
    emerald: "border-emerald-300/70 dark:border-emerald-500/40",
    emeraldSoft: "border-emerald-300/40 dark:border-emerald-500/30",
    inputDark: "border border-neutral-700",
    neutral: "border border-neutral-200 dark:border-neutral-800",
    neutralSoft: "border-neutral-200 dark:border-neutral-700",
    purpleSoft: "border border-purple-500/30",
  },
  surface: {
    card: "bg-white dark:bg-neutral-900",
    dangerSoft: "bg-red-500/10",
    emerald: "bg-emerald-500",
    emeraldSoft: "bg-emerald-500/10",
    inputDark: "bg-neutral-800",
    inputLightDark: "bg-neutral-100 dark:bg-neutral-800",
    neutralSoft: "bg-neutral-100 dark:bg-neutral-800",
    neutralSubtle: "bg-neutral-50 dark:bg-neutral-800/40",
    overlay: "bg-black/40",
    purpleSoft: "bg-purple-500/10",
  },
  text: {
    accent: "text-emerald-600 dark:text-emerald-400",
    accentHover: "hover:text-emerald-600 dark:hover:text-emerald-400",
    body: "text-neutral-700 dark:text-neutral-300",
    danger: "text-red-500",
    dangerSoft: "text-red-400",
    foreground: "text-foreground",
    inverse: "text-white",
    lg: "text-lg",
    medium: "font-medium",
    muted: "text-neutral-600 dark:text-neutral-400",
    semibold: "font-semibold",
    sm: "text-sm",
    subtle: "text-neutral-500 dark:text-neutral-400",
    tiny: "text-xs",
    uppercase: "uppercase",
    wide: "tracking-wider",
  },
  focus: {
    emerald: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
    emerald500: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
    foreground: "focus:outline-none focus:ring-2 focus:ring-foreground",
    input: "focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent",
    inputForeground: "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-transparent",
    neutral: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white",
  },
  motion: {
    colors: "transition-colors",
    all: "transition-all",
    duration200: "duration-200",
  },
  state: {
    cursorNotAllowed: "cursor-not-allowed",
    cursorPointer: "cursor-pointer",
    disabled: "opacity-50 cursor-not-allowed",
    disabledSoft: "disabled:opacity-40 disabled:cursor-not-allowed",
    hoverNeutral: "hover:bg-neutral-100 dark:hover:bg-neutral-800",
    hoverNeutralText: "hover:text-neutral-600 dark:hover:text-neutral-300",
  },
  sizing: {
    control44: "min-w-[44px] min-h-[44px]",
    iconXs: "h-3.5 w-3.5",
    iconSm: "h-4 w-4",
    iconMd: "h-5 w-5",
    voteColumn: "min-w-[40px]",
  },
} as const satisfies ClassNameTree;

const T = TAILWIND_CLASS_NAMES;

export const CLASS_GROUPS = {
  badge: {
    basePill: `${T.layout.shrink0} ${T.spacing.px2} ${T.spacing.py05} ${T.radius.full} ${T.text.tiny} ${T.text.medium}`,
    earnedPill: `${T.surface.emeraldSoft} ${T.text.accent}`,
    lockedPill: "bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
  },
  button: {
    iconAction: `${T.spacing.p1} ${T.radius.plain} ${T.motion.colors} ${T.focus.emerald500}`,
    iconLink: `text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white ${T.motion.colors} ${T.focus.neutral} ${T.radius.plain} ${T.spacing.p2} ${T.sizing.control44} ${T.layout.flex} ${T.layout.itemsCenter} ${T.layout.justifyCenter}`,
    neutral: `bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${T.motion.colors} ${T.focus.emerald}`,
  },
  card: {
    neutral: `${T.surface.card} ${T.radius.xl} ${T.border.neutral}`,
    neutralHover: "hover:border-neutral-300 dark:hover:border-neutral-700",
  },
  form: {
    errorText: `${T.text.dangerSoft} ${T.text.sm} ${T.spacing.mt2}`,
    inputDark: `${T.layout.wFull} ${T.spacing.px4} ${T.spacing.py3} ${T.surface.inputDark} ${T.border.inputDark} ${T.radius.lg} ${T.text.inverse} placeholder-neutral-400 ${T.focus.input}`,
    inputLightDark: `${T.layout.wFull} ${T.spacing.px4} ${T.spacing.py3} ${T.surface.inputLightDark} ${T.border.inputDark} ${T.radius.lg} ${T.text.foreground} text-base placeholder-neutral-400 ${T.focus.inputForeground}`,
    labelDark: `${T.layout.block} ${T.text.sm} ${T.text.medium} text-neutral-300 ${T.spacing.mb2}`,
  },
  status: {
    negativeScore: T.text.danger,
    positiveScore: T.text.accent,
    neutralScore: "text-neutral-500",
  },
  tag: {
    neutral: `${T.spacing.px2} ${T.spacing.py05} ${T.surface.neutralSoft} ${T.text.muted} ${T.radius.plain} ${T.text.tiny}`,
    neutralPill: "px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium rounded-full",
    neutralStrongPill: "px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-full",
    successPill: "px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full",
  },
  text: {
    body: `${T.text.sm} ${T.text.body}`,
    metadata: `${T.text.tiny} text-neutral-500`,
    muted: `${T.text.sm} ${T.text.muted}`,
    sectionLabel: `${T.text.tiny} ${T.text.uppercase} ${T.text.wide} ${T.text.subtle}`,
  },
  vote: {
    column: `${T.layout.flex} ${T.layout.flexCol} ${T.layout.itemsCenter} ${T.spacing.gap1} ${T.sizing.voteColumn}`,
    disabled: T.state.disabled,
    inactive: "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
    score: `${T.text.sm} ${T.text.semibold}`,
  },
} as const satisfies ClassNameTree;

