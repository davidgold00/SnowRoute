import { analyzeRoute } from "@/lib/analysis";
import {
  PublicHttpError,
  createJsonErrorResponse,
  createNoStoreJsonResponse,
  enforceRateLimit,
  readJsonBody,
} from "@/lib/server-security";
import { analyzeRouteInputSchema } from "@/lib/types";

const MAX_FORECAST_LOOKAHEAD_DAYS = 15;

export async function POST(request: Request) {
  const rateLimitedResponse = enforceRateLimit(request, "analyze", {
    maxRequests: 8,
    windowMs: 60 * 1000,
  });

  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  try {
    const parsedBody = await readJsonBody(request, {
      maxBytes: 8 * 1024,
    });

    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const payload = analyzeRouteInputSchema.safeParse(parsedBody.body);

    if (!payload.success) {
      return createJsonErrorResponse(
        400,
        "SnowRoute needs a locked origin, destination, and a valid departure time.",
      );
    }

    const departureDate = new Date(payload.data.departureTimeUtc);
    const now = Date.now();
    const maxForecastDate = now + MAX_FORECAST_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

    if (Number.isNaN(departureDate.getTime())) {
      return createJsonErrorResponse(
        400,
        "Departure time must be a valid UTC timestamp.",
      );
    }

    if (departureDate.getTime() < now - 60 * 60 * 1000) {
      return createJsonErrorResponse(
        400,
        "Departure time must be in the present or future so the forecast stays meaningful.",
      );
    }

    if (departureDate.getTime() > maxForecastDate) {
      return createJsonErrorResponse(
        400,
        `Departure time must be within the next ${MAX_FORECAST_LOOKAHEAD_DAYS} days to fit the forecast horizon.`,
      );
    }

    const analysis = await analyzeRoute(payload.data);

    return createNoStoreJsonResponse(analysis);
  } catch (error) {
    if (error instanceof PublicHttpError) {
      return createJsonErrorResponse(error.status, error.message, {
        code: error.code,
      });
    }

    const status =
      error instanceof Error && error.message.includes("Missing ORS_API_KEY")
        ? 500
        : 502;

    return createJsonErrorResponse(
      status,
      status === 500
        ? "Server configuration is incomplete."
        : "SnowRoute could not analyze that route right now.",
    );
  }
}
