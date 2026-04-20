import { NextResponse } from "next/server";

import { analyzeRoute } from "@/lib/analysis";
import { analyzeRouteInputSchema } from "@/lib/types";

const MAX_FORECAST_LOOKAHEAD_DAYS = 15;

export async function POST(request: Request) {
  try {
    const payload = analyzeRouteInputSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          message: "SnowRoute needs a locked origin, destination, and a valid departure time.",
        },
        { status: 400 },
      );
    }

    const departureDate = new Date(payload.data.departureTimeUtc);
    const now = Date.now();
    const maxForecastDate = now + MAX_FORECAST_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

    if (Number.isNaN(departureDate.getTime())) {
      return NextResponse.json(
        {
          message: "Departure time must be a valid UTC timestamp.",
        },
        { status: 400 },
      );
    }

    if (departureDate.getTime() < now - 60 * 60 * 1000) {
      return NextResponse.json(
        {
          message: "Departure time must be in the present or future so the forecast stays meaningful.",
        },
        { status: 400 },
      );
    }

    if (departureDate.getTime() > maxForecastDate) {
      return NextResponse.json(
        {
          message: `Departure time must be within the next ${MAX_FORECAST_LOOKAHEAD_DAYS} days to fit the forecast horizon.`,
        },
        { status: 400 },
      );
    }

    const analysis = await analyzeRoute(payload.data);

    return NextResponse.json(analysis);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "SnowRoute could not analyze that route right now.";
    const status = message.includes("Missing ORS_API_KEY") ? 500 : 502;

    return NextResponse.json({ message }, { status });
  }
}
