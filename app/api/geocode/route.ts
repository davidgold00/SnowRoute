import { NextResponse } from "next/server";

import {
  AppError,
  createCorrelationId,
  createFailureResponse,
  createSuccessResponse,
  logServerError,
  mapProviderException,
} from "@/lib/app-error";
import { geocodeLocation } from "@/lib/routing";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { geocodeQuerySchema } from "@/lib/types";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlationId = createCorrelationId();
  const rateLimit = await enforceRateLimit(request, RATE_LIMIT_POLICIES.geocode);

  if (!rateLimit.allowed) {
    const appError = new AppError("GEOCODER_RATE_LIMITED");
    return NextResponse.json(createFailureResponse(appError, correlationId), {
      status: appError.statusCode,
      headers: rateLimitHeaders(rateLimit),
    });
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > 4_096) {
      throw new AppError("INVALID_REQUEST", {
        statusCode: 413,
        userTitle: "That location search is too large.",
        userMessage: "Shorten the location text and try again.",
      });
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch (error) {
      throw new AppError("INVALID_REQUEST", {
        cause: error,
        userTitle: "Enter a location to search.",
        userMessage: "Location search needs a valid text query.",
      });
    }

    const payload = geocodeQuerySchema.safeParse(requestBody);

    if (!payload.success) {
      throw new AppError("INVALID_REQUEST", {
        userTitle: "Enter a more complete location.",
        userMessage: "Use between 2 and 200 characters for a place or address search.",
      });
    }

    const suggestions = await geocodeLocation(payload.data.query, request.signal);

    return NextResponse.json(createSuccessResponse(suggestions, correlationId, startedAt), {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    const appError = mapProviderException("geocoding", error);

    logServerError({
      event: "geocode_search_failed",
      correlationId,
      stage: "geocoding",
      provider: "openrouteservice",
      error: appError,
      startedAt,
    });

    return NextResponse.json(
      createFailureResponse(appError, correlationId),
      { status: appError.statusCode, headers: rateLimitHeaders(rateLimit) },
    );
  }
}
