import type { Metadata } from "next";

const title = "Prompt & Rules Cookbook | Cursor Boston";
const description =
  "Share and discover Cursor prompts, rules files, and AI-assisted development workflows with the Boston Cursor community.";

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
    canonical: "https://cursorboston.com/cookbook",
  },
};

export default function CookbookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
