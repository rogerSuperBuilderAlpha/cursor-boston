import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hack-a-Sprint 2026 — Showcase & voting",
  description:
    "Submit your build via GitHub PR, then vote with participants, community, and judges. Sign in required.",
};

export default function HackASprint2026Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
