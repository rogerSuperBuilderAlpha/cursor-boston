import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit a Talk",
  description: "Submit a talk proposal for Cursor Boston events and meetups.",
};

export default function TalkSubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
