import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Team",
  description: "Join the team pool to find teammates for Cursor Boston hackathons.",
};

export default function PoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
