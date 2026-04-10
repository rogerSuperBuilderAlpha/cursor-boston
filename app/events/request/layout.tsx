/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request an Event",
  description: "Submit an idea for a Cursor workshop, meetup, or hackathon in Boston.",
};

export default function EventRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
