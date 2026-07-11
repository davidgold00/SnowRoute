export type AppErrorCode =
  | "START_CITY_EMPTY"
  | "START_CITY_UNRESOLVED"
  | "START_CITY_NOT_FOUND"
  | "START_CITY_AMBIGUOUS"
  | "DESTINATION_CITY_EMPTY"
  | "DESTINATION_CITY_UNRESOLVED"
  | "DESTINATION_CITY_NOT_FOUND"
  | "DESTINATION_CITY_AMBIGUOUS"
  | "SHARED_CITY_UNRESOLVED"
  | "START_PLACE_UNRESOLVED"
  | "START_PLACE_NOT_FOUND"
  | "START_PLACE_OUTSIDE_SELECTED_CITY"
  | "START_PLACE_IMPRECISE"
  | "DESTINATION_PLACE_UNRESOLVED"
  | "DESTINATION_PLACE_NOT_FOUND"
  | "DESTINATION_PLACE_OUTSIDE_SELECTED_CITY"
  | "DESTINATION_PLACE_IMPRECISE"
  | "SAME_EFFECTIVE_LOCATION"
  | "ORIGIN_EMPTY"
  | "DESTINATION_EMPTY"
  | "BOTH_LOCATIONS_EMPTY"
  | "ORIGIN_NOT_FOUND"
  | "DESTINATION_NOT_FOUND"
  | "BOTH_LOCATIONS_NOT_FOUND"
  | "ORIGIN_AMBIGUOUS"
  | "DESTINATION_AMBIGUOUS"
  | "BOTH_LOCATIONS_AMBIGUOUS"
  | "ORIGIN_IMPRECISE"
  | "DESTINATION_IMPRECISE"
  | "ORIGIN_OUTSIDE_SERVICE_AREA"
  | "DESTINATION_OUTSIDE_SERVICE_AREA"
  | "INVALID_ORIGIN_COORDINATES"
  | "INVALID_DESTINATION_COORDINATES"
  | "SAME_ORIGIN_AND_DESTINATION"
  | "GEOCODER_TIMEOUT"
  | "GEOCODER_RATE_LIMITED"
  | "GEOCODER_UNAVAILABLE"
  | "GEOCODER_INVALID_RESPONSE"
  | "NO_DRIVABLE_ROUTE"
  | "ROUTE_TOO_LONG"
  | "ROUTE_OUTSIDE_SUPPORTED_REGION"
  | "ROUTER_TIMEOUT"
  | "ROUTER_RATE_LIMITED"
  | "ROUTER_UNAVAILABLE"
  | "ROUTER_INVALID_RESPONSE"
  | "FORECAST_UNAVAILABLE"
  | "FORECAST_PARTIALLY_UNAVAILABLE"
  | "DEPARTURE_OUTSIDE_FORECAST_RANGE"
  | "WEATHER_PROVIDER_TIMEOUT"
  | "WEATHER_PROVIDER_RATE_LIMITED"
  | "WEATHER_PROVIDER_UNAVAILABLE"
  | "WEATHER_PROVIDER_INVALID_RESPONSE"
  | "NETWORK_OFFLINE"
  | "REQUEST_ABORTED"
  | "REQUEST_TIMEOUT"
  | "ANALYSIS_RATE_LIMITED"
  | "INVALID_REQUEST"
  | "INTERNAL_ANALYSIS_ERROR"
  | "CONFIGURATION_ERROR";

export type AppErrorField =
  | "startCity"
  | "startPlace"
  | "destinationCity"
  | "destinationPlace"
  | "origin"
  | "destination"
  | "departure"
  | "general";

type ErrorDefinition = {
  userTitle: string;
  userMessage: string;
  field: AppErrorField;
  retryable: boolean;
  statusCode: number;
};

const ERROR_DEFINITIONS: Record<AppErrorCode, ErrorDefinition> = {
  START_CITY_EMPTY: {
    userTitle: "Choose a starting city.",
    userMessage: "Select a city from the suggestions before analyzing the route.",
    field: "startCity",
    retryable: false,
    statusCode: 400,
  },
  START_CITY_UNRESOLVED: {
    userTitle: "Choose a starting city.",
    userMessage: "Select a city from the suggestions before analyzing the route.",
    field: "startCity",
    retryable: false,
    statusCode: 422,
  },
  START_CITY_NOT_FOUND: {
    userTitle: "We couldn’t find the starting city.",
    userMessage: "Check the spelling and include a state, province, or country when helpful.",
    field: "startCity",
    retryable: false,
    statusCode: 422,
  },
  START_CITY_AMBIGUOUS: {
    userTitle: "Choose the correct starting city.",
    userMessage: "Select the city with the intended region and country.",
    field: "startCity",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_CITY_EMPTY: {
    userTitle: "Choose a destination city.",
    userMessage: "Select a city from the suggestions before analyzing the route.",
    field: "destinationCity",
    retryable: false,
    statusCode: 400,
  },
  DESTINATION_CITY_UNRESOLVED: {
    userTitle: "Choose a destination city.",
    userMessage: "Select a city from the suggestions before analyzing the route.",
    field: "destinationCity",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_CITY_NOT_FOUND: {
    userTitle: "We couldn’t find the destination city.",
    userMessage: "Check the spelling and include a state, province, or country when helpful.",
    field: "destinationCity",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_CITY_AMBIGUOUS: {
    userTitle: "Choose the correct destination city.",
    userMessage: "Select the city with the intended region and country.",
    field: "destinationCity",
    retryable: false,
    statusCode: 422,
  },
  SHARED_CITY_UNRESOLVED: {
    userTitle: "Choose the shared city.",
    userMessage: "Both route points need a confirmed city before place search is available.",
    field: "startCity",
    retryable: false,
    statusCode: 422,
  },
  START_PLACE_UNRESOLVED: {
    userTitle: "Choose a starting address or leave it blank.",
    userMessage: "Select a suggested location in the starting city, or clear the field to use the city.",
    field: "startPlace",
    retryable: false,
    statusCode: 422,
  },
  START_PLACE_NOT_FOUND: {
    userTitle: "We couldn’t find that starting address.",
    userMessage: "Check the street number and name, try a nearby business or landmark, or use the selected city.",
    field: "startPlace",
    retryable: false,
    statusCode: 422,
  },
  START_PLACE_OUTSIDE_SELECTED_CITY: {
    userTitle: "That starting point is outside the selected city.",
    userMessage: "Update the city or choose another result within it.",
    field: "startPlace",
    retryable: false,
    statusCode: 422,
  },
  START_PLACE_IMPRECISE: {
    userTitle: "That starting-point match is approximate.",
    userMessage: "Choose a more precise result or leave the field blank to use the city center explicitly.",
    field: "startPlace",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_PLACE_UNRESOLVED: {
    userTitle: "Choose a destination address or leave it blank.",
    userMessage: "Select a suggested location in the destination city, or clear the field to use the city.",
    field: "destinationPlace",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_PLACE_NOT_FOUND: {
    userTitle: "We couldn’t find that destination address.",
    userMessage: "Check the street number and name, try a nearby business or landmark, or use the selected city.",
    field: "destinationPlace",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_PLACE_OUTSIDE_SELECTED_CITY: {
    userTitle: "That destination is outside the selected city.",
    userMessage: "Update the city or choose another result within it.",
    field: "destinationPlace",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_PLACE_IMPRECISE: {
    userTitle: "That destination match is approximate.",
    userMessage: "Choose a more precise result or leave the field blank to use the city center explicitly.",
    field: "destinationPlace",
    retryable: false,
    statusCode: 422,
  },
  SAME_EFFECTIVE_LOCATION: {
    userTitle: "The starting point and destination are the same.",
    userMessage: "Choose two different addresses or places.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  ORIGIN_EMPTY: {
    userTitle: "Enter a starting location.",
    userMessage: "Choose a suggested address, place, or city before analyzing.",
    field: "origin",
    retryable: false,
    statusCode: 400,
  },
  DESTINATION_EMPTY: {
    userTitle: "Enter a destination.",
    userMessage: "Choose a suggested address, place, or city before analyzing.",
    field: "destination",
    retryable: false,
    statusCode: 400,
  },
  BOTH_LOCATIONS_EMPTY: {
    userTitle: "Enter both route locations.",
    userMessage: "Choose a starting location and destination from the suggested matches.",
    field: "general",
    retryable: false,
    statusCode: 400,
  },
  ORIGIN_NOT_FOUND: {
    userTitle: "We couldn’t find the starting location.",
    userMessage: "Check the street name, city, region, or postal code.",
    field: "origin",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_NOT_FOUND: {
    userTitle: "We couldn’t find the destination.",
    userMessage: "Choose a suggested address or enter a more complete location.",
    field: "destination",
    retryable: false,
    statusCode: 422,
  },
  BOTH_LOCATIONS_NOT_FOUND: {
    userTitle: "We couldn’t find either location.",
    userMessage:
      "Check the starting address and destination. Include a city, state or province, and postal code when possible.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  ORIGIN_AMBIGUOUS: {
    userTitle: "Choose the correct starting location.",
    userMessage: "We found multiple possibilities. Select one of the suggested addresses.",
    field: "origin",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_AMBIGUOUS: {
    userTitle: "Choose the correct destination.",
    userMessage: "We found multiple possibilities. Select one of the suggested addresses.",
    field: "destination",
    retryable: false,
    statusCode: 422,
  },
  BOTH_LOCATIONS_AMBIGUOUS: {
    userTitle: "Choose both route locations.",
    userMessage: "Select a specific suggested match for the starting location and destination.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  ORIGIN_IMPRECISE: {
    userTitle: "The starting location is not precise enough.",
    userMessage: "Choose a street-level or exact-address result when possible.",
    field: "origin",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_IMPRECISE: {
    userTitle: "The destination is not precise enough.",
    userMessage: "Choose a street-level or exact-address result when possible.",
    field: "destination",
    retryable: false,
    statusCode: 422,
  },
  ORIGIN_OUTSIDE_SERVICE_AREA: {
    userTitle: "The starting location is outside the supported area.",
    userMessage: "Choose a location that can be reached by the configured road network.",
    field: "origin",
    retryable: false,
    statusCode: 422,
  },
  DESTINATION_OUTSIDE_SERVICE_AREA: {
    userTitle: "The destination is outside the supported area.",
    userMessage: "Choose a location that can be reached by the configured road network.",
    field: "destination",
    retryable: false,
    statusCode: 422,
  },
  INVALID_ORIGIN_COORDINATES: {
    userTitle: "The starting location is not valid.",
    userMessage: "Search again and choose a suggested starting location.",
    field: "origin",
    retryable: false,
    statusCode: 400,
  },
  INVALID_DESTINATION_COORDINATES: {
    userTitle: "The destination is not valid.",
    userMessage: "Search again and choose a suggested destination.",
    field: "destination",
    retryable: false,
    statusCode: 400,
  },
  SAME_ORIGIN_AND_DESTINATION: {
    userTitle: "The starting location and destination are the same.",
    userMessage: "Enter two different locations to build a route.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  GEOCODER_TIMEOUT: {
    userTitle: "Location search took too long.",
    userMessage: "Keep your entry and try the search again.",
    field: "general",
    retryable: true,
    statusCode: 504,
  },
  GEOCODER_RATE_LIMITED: {
    userTitle: "Location search is busy right now.",
    userMessage: "Keep your entry and try again shortly.",
    field: "general",
    retryable: true,
    statusCode: 429,
  },
  GEOCODER_UNAVAILABLE: {
    userTitle: "Location search is temporarily unavailable.",
    userMessage: "Your entry is preserved. Try the search again in a moment.",
    field: "general",
    retryable: true,
    statusCode: 503,
  },
  GEOCODER_INVALID_RESPONSE: {
    userTitle: "Location search returned an incomplete result.",
    userMessage: "Try the search again or enter a more complete address.",
    field: "general",
    retryable: true,
    statusCode: 502,
  },
  NO_DRIVABLE_ROUTE: {
    userTitle: "We found both locations, but no drivable route between them.",
    userMessage: "Confirm that both points are accessible by road and within the supported region.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  ROUTE_TOO_LONG: {
    userTitle: "This route is too long to analyze responsibly.",
    userMessage: "Choose a shorter trip or divide the drive into separate routes.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  ROUTE_OUTSIDE_SUPPORTED_REGION: {
    userTitle: "Part of this route is outside the supported road network.",
    userMessage: "Choose locations within the supported region.",
    field: "general",
    retryable: false,
    statusCode: 422,
  },
  ROUTER_TIMEOUT: {
    userTitle: "Building the route took too long.",
    userMessage: "Your locations are valid. Try the analysis again.",
    field: "general",
    retryable: true,
    statusCode: 504,
  },
  ROUTER_RATE_LIMITED: {
    userTitle: "Route planning is busy right now.",
    userMessage: "Your locations are valid. Try the analysis again shortly.",
    field: "general",
    retryable: true,
    statusCode: 429,
  },
  ROUTER_UNAVAILABLE: {
    userTitle: "Routing is temporarily unavailable.",
    userMessage: "We found your locations. Try the analysis again in a moment.",
    field: "general",
    retryable: true,
    statusCode: 503,
  },
  ROUTER_INVALID_RESPONSE: {
    userTitle: "The route could not be verified.",
    userMessage: "The routing service returned incomplete information. Try again.",
    field: "general",
    retryable: true,
    statusCode: 502,
  },
  FORECAST_UNAVAILABLE: {
    userTitle: "A responsible forecast is not available for this route.",
    userMessage: "Try a different departure time or check again later.",
    field: "general",
    retryable: true,
    statusCode: 503,
  },
  FORECAST_PARTIALLY_UNAVAILABLE: {
    userTitle: "Some route forecasts are unavailable.",
    userMessage: "SnowRoute cannot verify enough of this drive to provide a full-confidence result.",
    field: "general",
    retryable: true,
    statusCode: 502,
  },
  DEPARTURE_OUTSIDE_FORECAST_RANGE: {
    userTitle: "That departure is outside the available forecast window.",
    userMessage: "Choose a departure within the next 15 days.",
    field: "departure",
    retryable: false,
    statusCode: 422,
  },
  WEATHER_PROVIDER_TIMEOUT: {
    userTitle: "The route forecast took too long.",
    userMessage: "Keep your trip details and try the analysis again.",
    field: "general",
    retryable: true,
    statusCode: 504,
  },
  WEATHER_PROVIDER_RATE_LIMITED: {
    userTitle: "Weather data is busy right now.",
    userMessage: "Keep your trip details and try the analysis again shortly.",
    field: "general",
    retryable: true,
    statusCode: 429,
  },
  WEATHER_PROVIDER_UNAVAILABLE: {
    userTitle: "Route weather is temporarily unavailable.",
    userMessage: "SnowRoute cannot provide a responsible decision without that forecast. Try again.",
    field: "general",
    retryable: true,
    statusCode: 503,
  },
  WEATHER_PROVIDER_INVALID_RESPONSE: {
    userTitle: "The route forecast could not be verified.",
    userMessage: "The weather service returned incomplete information. Try again.",
    field: "general",
    retryable: true,
    statusCode: 502,
  },
  NETWORK_OFFLINE: {
    userTitle: "You appear to be offline.",
    userMessage: "Reconnect to the internet and try again.",
    field: "general",
    retryable: true,
    statusCode: 503,
  },
  REQUEST_ABORTED: {
    userTitle: "The request was canceled.",
    userMessage: "Your trip details are still available.",
    field: "general",
    retryable: true,
    statusCode: 499,
  },
  REQUEST_TIMEOUT: {
    userTitle: "The request took too long.",
    userMessage: "Keep your entries and try again.",
    field: "general",
    retryable: true,
    statusCode: 504,
  },
  ANALYSIS_RATE_LIMITED: {
    userTitle: "Too many route analyses were submitted.",
    userMessage: "Your trip details are preserved. Wait briefly and try again.",
    field: "general",
    retryable: true,
    statusCode: 429,
  },
  INVALID_REQUEST: {
    userTitle: "Check the trip details.",
    userMessage: "Correct the highlighted information and try again.",
    field: "general",
    retryable: false,
    statusCode: 400,
  },
  INTERNAL_ANALYSIS_ERROR: {
    userTitle: "SnowRoute could not complete this analysis.",
    userMessage: "Your trip details are preserved. Try again, or use the reference below if the issue continues.",
    field: "general",
    retryable: true,
    statusCode: 500,
  },
  CONFIGURATION_ERROR: {
    userTitle: "SnowRoute is not fully configured.",
    userMessage: "Route analysis is temporarily unavailable. Please try again later.",
    field: "general",
    retryable: false,
    statusCode: 503,
  },
};

export type PublicFieldError = {
  code: AppErrorCode;
  title: string;
  message: string;
};

export type PublicAppError = {
  code: AppErrorCode;
  title: string;
  message: string;
  field?: AppErrorField;
  retryable: boolean;
  correlationId?: string;
  fieldErrors?: Partial<Record<Exclude<AppErrorField, "general">, PublicFieldError>>;
};

export type ApiMeta = {
  correlationId: string;
  durationMs: number;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = {
  ok: false;
  error: PublicAppError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type AppErrorOptions = Partial<
  Pick<ErrorDefinition, "userTitle" | "userMessage" | "field" | "retryable" | "statusCode">
> & {
  cause?: unknown;
  fieldErrors?: PublicAppError["fieldErrors"];
  technicalContext?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userTitle: string;
  readonly userMessage: string;
  readonly field: AppErrorField;
  readonly retryable: boolean;
  readonly statusCode: number;
  readonly fieldErrors?: PublicAppError["fieldErrors"];
  readonly technicalContext?: Record<string, unknown>;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    const definition = ERROR_DEFINITIONS[code];
    super(options.userMessage ?? definition.userMessage);
    this.name = "AppError";
    this.code = code;
    this.userTitle = options.userTitle ?? definition.userTitle;
    this.userMessage = options.userMessage ?? definition.userMessage;
    this.field = options.field ?? definition.field;
    this.retryable = options.retryable ?? definition.retryable;
    this.statusCode = options.statusCode ?? definition.statusCode;
    this.fieldErrors = options.fieldErrors;
    this.technicalContext = options.technicalContext;

    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        value: options.cause,
      });
    }
  }
}

export function createCorrelationId() {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `SR-${randomPart.toUpperCase()}`;
}

export function toPublicAppError(error: AppError, correlationId?: string): PublicAppError {
  return {
    code: error.code,
    title: error.userTitle,
    message: error.userMessage,
    field: error.field,
    retryable: error.retryable,
    correlationId,
    fieldErrors: error.fieldErrors,
  };
}

export function createPublicAppError(
  code: AppErrorCode,
  correlationId?: string,
): PublicAppError {
  return toPublicAppError(new AppError(code), correlationId);
}

export function createSuccessResponse<T>(
  data: T,
  correlationId: string,
  startedAt: number,
): ApiSuccess<T> {
  return {
    ok: true,
    data,
    meta: {
      correlationId,
      durationMs: Math.max(0, Date.now() - startedAt),
    },
  };
}

export function createFailureResponse(
  error: AppError,
  correlationId: string,
): ApiFailure {
  return {
    ok: false,
    error: toPublicAppError(error, correlationId),
  };
}

export function isApiSuccess<T>(payload: unknown): payload is ApiSuccess<T> {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      payload.ok === true &&
      "data" in payload,
  );
}

export function isApiFailure(payload: unknown): payload is ApiFailure {
  if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== false) {
    return false;
  }

  if (!("error" in payload) || !payload.error || typeof payload.error !== "object") {
    return false;
  }

  return (
    "code" in payload.error &&
    typeof payload.error.code === "string" &&
    "title" in payload.error &&
    typeof payload.error.title === "string" &&
    "message" in payload.error &&
    typeof payload.error.message === "string" &&
    "retryable" in payload.error &&
    typeof payload.error.retryable === "boolean"
  );
}

type ProviderStage = "geocoding" | "routing" | "weather";

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function isTimeoutError(error: unknown) {
  return (
    (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) ||
    (error instanceof Error && /timed? ?out|timeout/i.test(`${error.name} ${error.message}`))
  );
}

export function mapProviderResponseError(
  stage: ProviderStage,
  status: number,
  providerMessage = "",
): AppError {
  const normalizedMessage = providerMessage.toLowerCase();
  const commonContext = { providerStatus: status, stage };

  if (status === 401 || status === 403) {
    return new AppError("CONFIGURATION_ERROR", { technicalContext: commonContext });
  }

  if (stage === "geocoding") {
    const code =
      status === 429
        ? "GEOCODER_RATE_LIMITED"
        : status === 408 || status === 504
          ? "GEOCODER_TIMEOUT"
          : status >= 500
            ? "GEOCODER_UNAVAILABLE"
            : "GEOCODER_INVALID_RESPONSE";

    return new AppError(code, { technicalContext: commonContext });
  }

  if (stage === "routing") {
    if (
      [400, 404, 422].includes(status) ||
      includesAny(normalizedMessage, [
        "no route",
        "unable to find a route",
        "could not find point",
        "not routable",
      ])
    ) {
      return new AppError("NO_DRIVABLE_ROUTE", { technicalContext: commonContext });
    }

    const code =
      status === 429
        ? "ROUTER_RATE_LIMITED"
        : status === 408 || status === 504
          ? "ROUTER_TIMEOUT"
          : status >= 500
            ? "ROUTER_UNAVAILABLE"
            : "ROUTER_INVALID_RESPONSE";

    return new AppError(code, { technicalContext: commonContext });
  }

  const code =
    status === 429
      ? "WEATHER_PROVIDER_RATE_LIMITED"
      : status === 408 || status === 504
        ? "WEATHER_PROVIDER_TIMEOUT"
        : status >= 500
          ? "WEATHER_PROVIDER_UNAVAILABLE"
          : "WEATHER_PROVIDER_INVALID_RESPONSE";

  return new AppError(code, { technicalContext: commonContext });
}

export function mapProviderException(stage: ProviderStage, error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isTimeoutError(error)) {
    const timeoutCode =
      stage === "geocoding"
        ? "GEOCODER_TIMEOUT"
        : stage === "routing"
          ? "ROUTER_TIMEOUT"
          : "WEATHER_PROVIDER_TIMEOUT";

    return new AppError(timeoutCode, { cause: error, technicalContext: { stage } });
  }

  const unavailableCode =
    stage === "geocoding"
      ? "GEOCODER_UNAVAILABLE"
      : stage === "routing"
        ? "ROUTER_UNAVAILABLE"
        : "WEATHER_PROVIDER_UNAVAILABLE";

  return new AppError(unavailableCode, { cause: error, technicalContext: { stage } });
}

export function normalizeAnalysisError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;

    if (
      code === "WEATHER_PROVIDER_TIMEOUT" ||
      code === "WEATHER_PROVIDER_UNAVAILABLE" ||
      code === "WEATHER_PROVIDER_INVALID_RESPONSE" ||
      code === "FORECAST_UNAVAILABLE" ||
      code === "FORECAST_PARTIALLY_UNAVAILABLE"
    ) {
      return new AppError(code, { cause: error });
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("missing ors_api_key")) {
    return new AppError("CONFIGURATION_ERROR", { cause: error });
  }

  if (
    includesAny(message, [
      "did not return a drivable path",
      "no drivable route",
      "unable to find a route",
      "could not find point",
    ])
  ) {
    return new AppError("NO_DRIVABLE_ROUTE", { cause: error });
  }

  if (message.includes("routing request failed")) {
    return mapProviderException("routing", error);
  }

  if (message.includes("weather request failed")) {
    const statusMatch = message.match(/status\s+(\d{3})/);

    return statusMatch
      ? mapProviderResponseError("weather", Number(statusMatch[1]))
      : mapProviderException("weather", error);
  }

  return new AppError("INTERNAL_ANALYSIS_ERROR", { cause: error });
}

function getFieldError(code: AppErrorCode): PublicFieldError {
  const definition = ERROR_DEFINITIONS[code];

  return {
    code,
    title: definition.userTitle,
    message: definition.userMessage,
  };
}

type LocationPayload = {
  label?: unknown;
  lat?: unknown;
  lon?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isValidCoordinate(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function getLocationPayloadError(
  value: unknown,
  field: "origin" | "destination",
): AppErrorCode | null {
  const emptyCode = field === "origin" ? "ORIGIN_EMPTY" : "DESTINATION_EMPTY";
  const invalidCode =
    field === "origin" ? "INVALID_ORIGIN_COORDINATES" : "INVALID_DESTINATION_COORDINATES";

  if (value === null || value === undefined || value === "") {
    return emptyCode;
  }

  if (!isObject(value)) {
    return invalidCode;
  }

  const location = value as LocationPayload;

  if (typeof location.label !== "string" || location.label.trim().length === 0) {
    return emptyCode;
  }

  if (
    !isValidCoordinate(location.lat, -90, 90) ||
    !isValidCoordinate(location.lon, -180, 180)
  ) {
    return invalidCode;
  }

  return null;
}

function distanceBetweenCoordinatesKm(origin: LocationPayload, destination: LocationPayload) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const originLat = origin.lat as number;
  const originLon = origin.lon as number;
  const destinationLat = destination.lat as number;
  const destinationLon = destination.lon as number;
  const latDelta = toRadians(destinationLat - originLat);
  const lonDelta = toRadians(destinationLon - originLon);
  const originLatRadians = toRadians(originLat);
  const destinationLatRadians = toRadians(destinationLat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(originLatRadians) *
      Math.cos(destinationLatRadians) *
      Math.sin(lonDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function validateAnalyzeLocations(payload: unknown): AppError | null {
  if (!isObject(payload)) {
    return new AppError("INVALID_REQUEST");
  }

  const originError = getLocationPayloadError(payload.origin, "origin");
  const destinationError = getLocationPayloadError(payload.destination, "destination");

  if (originError && destinationError) {
    const combinedCode =
      originError === "ORIGIN_EMPTY" && destinationError === "DESTINATION_EMPTY"
        ? "BOTH_LOCATIONS_EMPTY"
        : "INVALID_REQUEST";

    return new AppError(combinedCode, {
      userTitle:
        combinedCode === "INVALID_REQUEST"
          ? "Check both route locations."
          : undefined,
      userMessage:
        combinedCode === "INVALID_REQUEST"
          ? "Search again and choose a valid suggested match for both locations."
          : undefined,
      fieldErrors: {
        origin: getFieldError(originError),
        destination: getFieldError(destinationError),
      },
    });
  }

  if (originError) {
    return new AppError(originError, {
      fieldErrors: { origin: getFieldError(originError) },
    });
  }

  if (destinationError) {
    return new AppError(destinationError, {
      fieldErrors: { destination: getFieldError(destinationError) },
    });
  }

  if (
    distanceBetweenCoordinatesKm(
      payload.origin as LocationPayload,
      payload.destination as LocationPayload,
    ) < 0.01
  ) {
    return new AppError("SAME_EFFECTIVE_LOCATION");
  }

  return null;
}

export function logServerError({
  event,
  correlationId,
  stage,
  error,
  startedAt,
  provider,
}: {
  event: string;
  correlationId: string;
  stage: string;
  error: AppError;
  startedAt: number;
  provider?: string;
}) {
  console.error(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      correlationId,
      stage,
      provider,
      errorCode: error.code,
      status: error.statusCode,
      durationMs: Math.max(0, Date.now() - startedAt),
      retryable: error.retryable,
      context: error.technicalContext,
      stack: error.stack,
    }),
  );
}
