import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import WelcomeModal from "@/components/WelcomeModal";
import LumaCheckoutTracker from "@/components/LumaCheckoutTracker";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: {
    default: "Cursor Boston",
    template: "%s | Cursor Boston",
  },
  description:
    "Bringing Cursor users together in Beantown. Join us for meetups, workshops, and community events for AI-powered development.",
  // NOTE: Replace "cursorboston.com" with your actual domain
  metadataBase: new URL("https://cursorboston.com"),
  openGraph: {
    title: "Cursor Boston",
    description:
      "Bringing Cursor users together in Beantown. Meetups, workshops, and community for AI-powered development.",
    // NOTE: Replace "cursorboston.com" with your actual domain
    url: "https://cursorboston.com",
    siteName: "Cursor Boston",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Cursor Boston - AI-powered development community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cursor Boston",
    description:
      "Bringing Cursor users together in Beantown. Meetups, workshops, and community for AI-powered development.",
    images: ["/twitter-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script id="luma-checkout" src="https://embed.lu.ma/checkout-button.js" async></script>
      </head>
      <body className="antialiased bg-black text-white min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-lg focus:font-semibold"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <Navigation />
          <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
          <Footer />
          <WelcomeModal />
          <LumaCheckoutTracker />
        </AuthProvider>
      </body>
    </html>
  );
}
