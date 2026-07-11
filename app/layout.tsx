import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "SnowRoute | Winter & Severe-Weather Drive Advisor",
    template: "%s | SnowRoute",
  },
  description:
    "Analyze a drive by arrival time, understand winter and severe-weather hazards, and get clear GO, CAUTION, DELAY, HOLD, or AVOID guidance.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full">
        <div className="site-shell">
          <a
            href="#main-content"
            className="fixed -top-20 left-4 z-[1000] rounded-md bg-[#176c68] px-4 py-3 text-sm font-bold text-white shadow-lg transition-[top] focus:top-3"
          >
            Skip to main content
          </a>
          <SiteHeader />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
