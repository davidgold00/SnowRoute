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
      <body className="min-h-full bg-[#08161d] text-slate-100">
        <div className="site-shell">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
