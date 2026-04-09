import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hack-a-Sprint 2026 — Admin Dashboard",
  description: "Live event monitoring for organizers.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
