import { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Team",
  description: "Manage your hackathon team, view invites, and coordinate with teammates.",
};

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
