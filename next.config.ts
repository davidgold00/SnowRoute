import type { NextConfig } from "next";

function createContentSecurityPolicy() {
  const isDevelopment = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    [
      "script-src 'self' 'unsafe-inline'",
      isDevelopment ? "'unsafe-eval'" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      isDevelopment ? "ws: wss:" : "",
      "https://api.openrouteservice.org https://api.open-meteo.com",
      "https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
    ]
      .filter(Boolean)
      .join(" "),
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      return [];
    }

    const cspHeader = createContentSecurityPolicy();

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
