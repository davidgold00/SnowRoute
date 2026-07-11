import { NextResponse } from "next/server";

import {
  AppError,
  createCorrelationId,
  createFailureResponse,
  createSuccessResponse,
  logServerError,
  mapProviderException,
} from "@/lib/app-error";
import { searchPlaces } from "@/lib/geocoding";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { placeSearchRequestSchema } from "@/lib/types";

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

    if (contentLength > 16_384) {
      throw new AppError("INVALID_REQUEST", {
        statusCode: 413,
        userTitle: "That place search is too large.",
        userMessage: "Shorten the address or place name and try again.",
      });
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch (error) {
      throw new AppError("INVALID_REQUEST", {
        cause: error,
        userTitle: "Enter an address or place to search.",
        userMessage: "Place search needs valid text and a selected city.",
      });
    }

    const payload = placeSearchRequestSchema.safeParse(requestBody);

    if (!payload.success) {
      throw new AppError("INVALID_REQUEST", {
        userTitle: "Check the selected city and place search.",
        userMessage: "Select a valid city, then use between 2 and 160 characters for the address or place.",
      });
    }

    const outcome = await searchPlaces(payload.data, { signal: request.signal });
    const response = createSuccessResponse(outcome.data, correlationId, startedAt);

    console.info(JSON.stringify({
      event: "place_search_completed",
      timestamp: new Date().toISOString(),
      correlationId,
      durationMs: response.meta.durationMs,
      provider: "openrouteservice-pelias",
      queryLength: payload.data.query.length,
      countryCode: payload.data.city.countryCode,
      resultCount: outcome.data.results.length,
      nearbyResultCount: outcome.data.nearbyResults.length,
      usedUnitFallback: Boolean(outcome.data.unitRoutingNote),
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
      event: "place_search_failed",
      correlationId,
      stage: "place-geocoding",
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
