import { NextResponse } from "next/server";

import {
  AppError,
  createCorrelationId,
  createFailureResponse,
  createSuccessResponse,
  logServerError,
  mapProviderException,
} from "@/lib/app-error";
import { searchCities } from "@/lib/geocoding";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { citySearchRequestSchema } from "@/lib/types";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlationId = createCorrelationId();
  const rateLimit = await enforceRateLimit(request, RATE_LIMIT_POLICIES.geocode);

  if (!rateLimit.allowed) {
    const appError = new AppError("GEOCODER_RATE_LIMITED");
    return NextResponse.json(createFailureResponse(appError, correlationId), {
      status: appError.statusCode,
      headers: { ...RESPONSE_HEADERS, ...rateLimitHeaders(rateLimit) },
    });
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > 4_096) {
      throw new AppError("INVALID_REQUEST", {
        statusCode: 413,
        userTitle: "That city search is too large.",
        userMessage: "Shorten the city name and try again.",
      });
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch (error) {
      throw new AppError("INVALID_REQUEST", {
        cause: error,
        userTitle: "Enter a city to search.",
        userMessage: "City search needs a valid text query.",
      });
    }

    const payload = citySearchRequestSchema.safeParse(requestBody);

    if (!payload.success) {
      throw new AppError("INVALID_REQUEST", {
        userTitle: "Enter a more complete city name.",
        userMessage: "Use between 2 and 120 characters and a valid country code if supplied.",
      });
    }

    const outcome = await searchCities(payload.data, { signal: request.signal });
    const response = createSuccessResponse(outcome.data, correlationId, startedAt);

    console.info(JSON.stringify({
      event: "city_search_completed",
      timestamp: new Date().toISOString(),
      correlationId,
      durationMs: response.meta.durationMs,
      provider: "openrouteservice-pelias",
      queryLength: payload.data.query.length,
      countryCode: payload.data.countryCode ?? null,
      resultCount: outcome.data.results.length,
      cache: outcome.cacheStatus,
    }));

    return NextResponse.json(
      {
        ...response,
        meta: {
          ...response.meta,
          cache: outcome.cacheStatus,
          provider: "openrouteservice-pelias",
        },
      },
      { headers: { ...RESPONSE_HEADERS, ...rateLimitHeaders(rateLimit) } },
    );
  } catch (error) {
    const appError = request.signal.aborted
      ? new AppError("REQUEST_ABORTED")
      : mapProviderException("geocoding", error);

    logServerError({
      event: "city_search_failed",
      correlationId,
      stage: "city-geocoding",
      provider: "openrouteservice-pelias",
      error: appError,
      startedAt,
    });

    return NextResponse.json(createFailureResponse(appError, correlationId), {
      status: appError.statusCode,
      headers: { ...RESPONSE_HEADERS, ...rateLimitHeaders(rateLimit) },
    });
  }
}
