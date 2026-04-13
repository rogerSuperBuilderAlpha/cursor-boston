import type { Metadata } from "next";

const title = "Live Events | Cursor Boston";
const description =
  "Join live Cursor Boston events. Watch lightning talks, participate in real-time discussions, and connect with the community.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  alternates: {
    canonical: "https://cursorboston.com/live",
  },
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
