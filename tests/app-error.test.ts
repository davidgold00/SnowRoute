import { describe, expect, it } from "vitest";

import {
  AppError,
  createFailureResponse,
  createSuccessResponse,
  mapProviderResponseError,
  normalizeAnalysisError,
  toPublicAppError,
  validateAnalyzeLocations,
} from "../lib/app-error";

const validOrigin = {
  label: "123 Main Street, Toronto, Ontario, Canada",
  lat: 43.6532,
  lon: -79.3832,
};

const validDestination = {
  label: "200 René-Lévesque Boulevard, Montréal, Quebec, Canada",
  lat: 45.5019,
  lon: -73.5674,
};

describe("application errors", () => {
  it("returns independent field errors when both route locations are missing", () => {
    const error = validateAnalyzeLocations({});
    const publicError = error ? toPublicAppError(error, "SR-TEST") : null;

    expect(publicError).toMatchObject({
      code: "BOTH_LOCATIONS_EMPTY",
      correlationId: "SR-TEST",
      retryable: false,
      fieldErrors: {
        origin: { code: "ORIGIN_EMPTY" },
        destination: { code: "DESTINATION_EMPTY" },
      },
    });
  });

  it("identifies the invalid location without rejecting the valid location", () => {
    const error = validateAnalyzeLocations({
      origin: { ...validOrigin, lat: 200 },
      destination: validDestination,
    });

    expect(error?.code).toBe("INVALID_ORIGIN_COORDINATES");
    expect(error?.fieldErrors?.origin?.code).toBe("INVALID_ORIGIN_COORDINATES");
    expect(error?.fieldErrors?.destination).toBeUndefined();
  });

  it("rejects effectively identical origin and destination points before routing", () => {
    const error = validateAnalyzeLocations({
      origin: validOrigin,
      destination: {
        ...validOrigin,
        label: "Same building, another entrance",
        lat: validOrigin.lat + 0.00005,
      },
    });

    expect(error?.code).toBe("SAME_ORIGIN_AND_DESTINATION");
    expect(error?.statusCode).toBe(422);
  });

  it("maps provider statuses to stable internal codes", () => {
    expect(mapProviderResponseError("geocoding", 429).code).toBe(
      "GEOCODER_RATE_LIMITED",
    );
    expect(mapProviderResponseError("routing", 504).code).toBe("ROUTER_TIMEOUT");
    expect(
      mapProviderResponseError("routing", 400, "Unable to find a route between points").code,
    ).toBe("NO_DRIVABLE_ROUTE");
  });

  it("does not expose technical context in public error envelopes", () => {
    const error = new AppError("ROUTER_UNAVAILABLE", {
      technicalContext: {
        providerPayload: "secret provider response",
        authorization: "secret token",
      },
    });
    const response = createFailureResponse(error, "SR-PRIVATE");

    expect(response.error.code).toBe("ROUTER_UNAVAILABLE");
    expect(JSON.stringify(response)).not.toContain("secret");
    expect(JSON.stringify(response)).not.toContain("authorization");
  });

  it("wraps successful data with timing metadata", () => {
    const response = createSuccessResponse({ ready: true }, "SR-SUCCESS", Date.now() - 20);

    expect(response).toMatchObject({
      ok: true,
      data: { ready: true },
      meta: { correlationId: "SR-SUCCESS" },
    });
    expect(response.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("exposes clean local analysis throttling guidance", () => {
    const error = new AppError("ANALYSIS_RATE_LIMITED");

    expect(error.statusCode).toBe(429);
    expect(toPublicAppError(error)).toMatchObject({
      retryable: true,
      field: "general",
    });
  });

  it("preserves typed partial-forecast failures from the weather pipeline", () => {
    const error = normalizeAnalysisError({
      code: "FORECAST_PARTIALLY_UNAVAILABLE",
    });

    expect(error.code).toBe("FORECAST_PARTIALLY_UNAVAILABLE");
    expect(error.statusCode).toBe(502);
  });
});
