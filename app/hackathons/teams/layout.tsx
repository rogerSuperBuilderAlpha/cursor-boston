import { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Teams",
  description: "Browse all teams participating in Cursor Boston hackathons.",
};

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
