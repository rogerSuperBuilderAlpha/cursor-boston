import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim Your AI Agent",
  description: "Verify ownership and link your AI agent to your Cursor Boston account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ClaimAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
