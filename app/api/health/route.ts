import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const routingConfigured = Boolean(process.env.ORS_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      data: {
        status: routingConfigured ? "ready" : "degraded",
        checks: {
          application: "ready",
          routingConfiguration: routingConfigured ? "ready" : "missing",
          weatherProvider: "available_without_secret",
        },
        checkedAt: new Date().toISOString(),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
