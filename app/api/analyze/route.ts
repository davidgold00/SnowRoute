import { NextResponse } from "next/server";

import { analyzeRoute, type AnalysisTimingSummary } from "@/lib/analysis";
import {
  AppError,
  createCorrelationId,
  createFailureResponse,
  createSuccessResponse,
  logServerError,
  normalizeAnalysisError,
  validateAnalyzeLocations,
} from "@/lib/app-error";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { analyzeRouteInputSchema } from "@/lib/types";

const MAX_FORECAST_LOOKAHEAD_DAYS = 15;
const ANALYSIS_DEADLINE_MS = 35_000;

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function getFailureStage(error: AppError) {
  if (error.code.startsWith("ROUTER_") || error.code === "NO_DRIVABLE_ROUTE") {
    return "routing";
  }

  if (
    error.code.startsWith("WEATHER_") ||
    error.code.startsWith("FORECAST_") ||
    error.code === "DEPARTURE_OUTSIDE_FORECAST_RANGE"
  ) {
    return "forecast";
  }

  if (
    error.code.includes("ORIGIN") ||
    error.code.includes("DESTINATION") ||
    error.code.includes("LOCATIONS")
  ) {
    return "validation";
  }

  return "analysis";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const correlationId = createCorrelationId();
  const rateLimit = await enforceRateLimit(request, RATE_LIMIT_POLICIES.analysis);

  if (!rateLimit.allowed) {
    const appError = new AppError("ANALYSIS_RATE_LIMITED");
    return NextResponse.json(createFailureResponse(appError, correlationId), {
      status: appError.statusCode,
      headers: rateLimitHeaders(rateLimit),
    });
  }

  const deadlineController = new AbortController();
  const deadline = setTimeout(
    () => deadlineController.abort(new DOMException("Analysis deadline exceeded", "TimeoutError")),
    ANALYSIS_DEADLINE_MS,
  );
  const analysisSignal = AbortSignal.any([request.signal, deadlineController.signal]);
  let analysisTimings: AnalysisTimingSummary | null = null;

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > 32_768) {
      throw new AppError("INVALID_REQUEST", {
        statusCode: 413,
        userTitle: "Those trip details are too large.",
        userMessage: "Remove extra route details and submit again.",
      });
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch (error) {
      throw new AppError("INVALID_REQUEST", {
        cause: error,
        userTitle: "SnowRoute could not read those trip details.",
        userMessage: "Keep your entries and submit the trip again.",
      });
    }

    const locationError = validateAnalyzeLocations(requestBody);

    if (locationError) {
      throw locationError;
    }

    const payload = analyzeRouteInputSchema.safeParse(requestBody);

    if (!payload.success) {
      const departureIssue = payload.error.issues.some(
        (issue) => issue.path[0] === "departureTimeUtc",
      );

      throw new AppError("INVALID_REQUEST", {
        userTitle: departureIssue ? "Choose a valid departure time." : undefined,
        userMessage: departureIssue
          ? "Select a complete date and time before analyzing the route."
          : "Choose valid route locations, stops, and departure details.",
        field: departureIssue ? "departure" : "general",
      });
    }

    const departureDate = new Date(payload.data.departureTimeUtc);
    const now = Date.now();
    const maxForecastDate = now + MAX_FORECAST_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

    if (Number.isNaN(departureDate.getTime())) {
      throw new AppError("INVALID_REQUEST", {
        userTitle: "Choose a valid departure time.",
        userMessage: "Select a complete date and time before analyzing the route.",
        field: "departure",
      });
    }

    if (!isValidTimeZone(payload.data.clientTimeZone)) {
      throw new AppError("INVALID_REQUEST", {
        userTitle: "Choose a valid time zone.",
        userMessage: "Select the time zone where this trip begins.",
        field: "departure",
      });
    }

    if (departureDate.getTime() < now - 60 * 60 * 1000) {
      throw new AppError("INVALID_REQUEST", {
        userTitle: "Choose a current or future departure.",
        userMessage: "Past conditions cannot support a current route decision.",
        field: "departure",
      });
    }

    if (departureDate.getTime() > maxForecastDate) {
      throw new AppError("DEPARTURE_OUTSIDE_FORECAST_RANGE", {
        userMessage: `Choose a departure within the next ${MAX_FORECAST_LOOKAHEAD_DAYS} days.`,
      });
    }

    const analysis = await analyzeRoute(payload.data, {
      signal: analysisSignal,
      onTimings: (timings) => {
        analysisTimings = timings;
      },
    });

    console.info(JSON.stringify({
      event: "route_analysis_completed",
      timestamp: new Date().toISOString(),
      correlationId,
      durationMs: Math.max(0, Date.now() - startedAt),
      timings: analysisTimings,
      riskModelVersion: analysis.metadata.riskModelVersion,
    }));

    return NextResponse.json(createSuccessResponse(analysis, correlationId, startedAt), {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    const appError = deadlineController.signal.aborted
      ? new AppError("REQUEST_TIMEOUT")
      : request.signal.aborted
        ? new AppError("REQUEST_ABORTED")
        : normalizeAnalysisError(error);
    const stage = getFailureStage(appError);

    logServerError({
      event: "route_analysis_failed",
      correlationId,
      stage,
      provider:
        stage === "routing"
          ? "openrouteservice"
          : stage === "forecast"
            ? "open-meteo"
            : undefined,
      error: appError,
      startedAt,
    });

    return NextResponse.json(createFailureResponse(appError, correlationId), {
      status: appError.statusCode,
      headers: rateLimitHeaders(rateLimit),
    });
  } finally {
    clearTimeout(deadline);
  }
}
