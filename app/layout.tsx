import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "SnowRoute | Intelligent Winter Driving Risk Analyzer",
  description:
    "Assess winter driving risk across an entire route with time-aware forecasts and transparent segment scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#08111e] text-slate-100">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
