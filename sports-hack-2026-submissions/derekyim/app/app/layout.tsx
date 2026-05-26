import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celtics Green or Mean",
  description:
    "Snap a selfie at TD Garden — get hyped on the jumbotron or get roasted by AI. You choose.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-celtics-green min-h-screen text-white">
        {children}
      </body>
    </html>
  );
}
