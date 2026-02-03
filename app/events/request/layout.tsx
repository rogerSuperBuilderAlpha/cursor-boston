import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request an Event",
  description: "Submit an idea for a Cursor workshop, meetup, or hackathon in Boston.",
};

export default function EventRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
