/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hack-a-Sprint 2026 — Website signup & ranking",
  description:
    "Claim your spot on the Cursor Boston site. Rankings use merged PRs to cursor-boston and sign-up order. Top 50 are eligible for $50 Cursor credit.",
};

export default function HackASprint2026SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
