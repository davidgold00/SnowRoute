import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

import { SiteHeader } from "@/components/site-header";
import { Snowfall } from "@/components/snowfall";

import "./globals.css";

export const metadata: Metadata = {
  title: "SnowRoute | Winter Trip Planning",
  description: "Plan winter drives with route-level weather risk analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#08111e] text-slate-100">
        <Snowfall />
        <div className="site-shell">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
