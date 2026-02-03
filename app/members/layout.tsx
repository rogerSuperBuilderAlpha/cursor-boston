import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Members",
  description: "Connect with developers, designers, and innovators building with Cursor in Boston.",
  alternates: {
    canonical: "https://cursorboston.com/members",
  },
};

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
