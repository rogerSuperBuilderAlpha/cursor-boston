import type { Metadata } from "next";

const title = "AI Pair Programming | Cursor Boston";
const description =
  "Find a coding partner in the Cursor Boston community. Match with developers based on skills, interests, and availability for pair programming sessions.";

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
    canonical: "https://cursorboston.com/pair",
  },
};

export default function PairLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
