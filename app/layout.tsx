import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import WelcomeModal from "@/components/WelcomeModal";
import LumaCheckoutTracker from "@/components/LumaCheckoutTracker";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  alternates: {
    types: {
      "application/rss+xml": "https://cursorboston.com/feed.xml",
    },
  },
};

// JSON-LD structured data for Organization
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Cursor Boston",
  description:
    "Boston's community for AI-assisted development with Cursor IDE. Meetups, workshops, and hackathons for developers, founders, and students.",
  url: "https://cursorboston.com",
  logo: "https://cursorboston.com/cursor-boston-logo.png",
  sameAs: [
    "https://discord.gg/Wsncg8YYqc",
    "https://lu.ma/cursor-boston",
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Boston",
    addressRegion: "MA",
    addressCountry: "US",
  },
};

// JSON-LD structured data for WebSite with search action
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Cursor Boston",
  url: "https://cursorboston.com",
  description:
    "Boston's community for AI-assisted development with Cursor IDE.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning is required for next-themes to prevent mismatch errors
    // between server-rendered HTML (default theme) and client hydration (user preference).
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />
        <script id="luma-checkout" src="https://embed.lu.ma/checkout-button.js" async></script>
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-lg focus:font-semibold"
        >
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <Navigation />
            <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
            <Footer />
            <WelcomeModal />
            <LumaCheckoutTracker />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
