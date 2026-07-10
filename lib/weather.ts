import "server-only";

import { differenceInCalendarDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import type { Coordinate, NormalizedWeatherSnapshot } from "@/lib/types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_TTL_MS = 1000 * 60 * 15;
const MAX_MATCH_DISTANCE_MS = 1000 * 60 * 60 * 2;
const WEATHER_REQUEST_TIMEOUT_MS = 8_000;
const WEATHER_REQUEST_ATTEMPTS = 2;
const WEATHER_CACHE_MAX_ENTRIES = 500;
const WEATHER_BATCH_SIZE = 16;
const WEATHER_BATCH_CONCURRENCY = 3;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type ForecastRow = {
  timeUtc: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  snowfallCm: number | null;
  visibilityKm: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
};

type ForecastSeries = {
  timezone: string;
  rows: ForecastRow[];
};

type OpenMeteoResponse = {
  timezone?: string;
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation?: Array<number | null>;
    snowfall?: Array<number | null>;
    visibility?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
    weather_code?: Array<number | null>;
    is_day?: Array<number | null>;
  };
};

const nullableNumberSeries = z.array(z.number().finite().nullable());
const openMeteoResponseSchema = z.object({
  timezone: z.string().min(1).optional(),
  hourly: z.object({
    time: z.array(z.string()).optional(),
    temperature_2m: nullableNumberSeries.optional(),
    precipitation: nullableNumberSeries.optional(),
    snowfall: nullableNumberSeries.optional(),
    visibility: nullableNumberSeries.optional(),
    wind_speed_10m: nullableNumberSeries.optional(),
    wind_gusts_10m: nullableNumberSeries.optional(),
    weather_code: nullableNumberSeries.optional(),
    is_day: nullableNumberSeries.optional(),
  }).optional(),
});
const openMeteoPayloadSchema = z.union([
  openMeteoResponseSchema,
  z.array(openMeteoResponseSchema).min(1),
]);

type WeatherMatch = {
  pointTimeZone: string;
  weather: NormalizedWeatherSnapshot;
};

type WeatherSampleInput = {
  coordinate: Coordinate;
  etaUtc: string;
};

const forecastCache = new Map<string, CacheEntry<ForecastSeries>>();
const inFlightForecasts = new Map<string, Promise<ForecastSeries>>();

export class WeatherProviderError extends Error {
  readonly code:
    | "WEATHER_PROVIDER_TIMEOUT"
    | "WEATHER_PROVIDER_UNAVAILABLE"
    | "WEATHER_PROVIDER_INVALID_RESPONSE"
    | "FORECAST_UNAVAILABLE"
    | "FORECAST_PARTIALLY_UNAVAILABLE";

  constructor(
    code:
      | "WEATHER_PROVIDER_TIMEOUT"
      | "WEATHER_PROVIDER_UNAVAILABLE"
      | "WEATHER_PROVIDER_INVALID_RESPONSE"
      | "FORECAST_UNAVAILABLE"
      | "FORECAST_PARTIALLY_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "WeatherProviderError";
    this.code = code;
  }
}

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear skies",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Steady drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Steady rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Steady snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  value: T,
) {
  if (!cache.has(key) && cache.size >= WEATHER_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function getBucketKey(coordinate: Coordinate) {
  return `${coordinate.lat.toFixed(2)}:${coordinate.lon.toFixed(2)}`;
}

function buildWeatherSummary(snapshot: Omit<NormalizedWeatherSnapshot, "summary">) {
  const details = [snapshot.condition];

  if (typeof snapshot.temperatureC === "number") {
    details.push(`${snapshot.temperatureC.toFixed(0)}C`);
  }

  if (typeof snapshot.visibilityKm === "number") {
    details.push(`${snapshot.visibilityKm.toFixed(1)} km visibility`);
  }

  if (typeof snapshot.snowfallCm === "number" && snapshot.snowfallCm > 0.1) {
    details.push(`${snapshot.snowfallCm.toFixed(1)} cm snow`);
  } else if (
    typeof snapshot.precipitationMm === "number" &&
    snapshot.precipitationMm > 0.1
  ) {
    details.push(`${snapshot.precipitationMm.toFixed(1)} mm precipitation`);
  }

  return details.join(" • ");
}

function describeWeatherCode(code: number | null) {
  if (code === null) {
    return "Forecast unavailable";
  }

  return WEATHER_CODE_LABELS[code] ?? "Mixed weather conditions";
}

function waitForRetry(attempt: number) {
  const delayMs = 160 * 2 ** attempt + Math.floor(Math.random() * 120);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function requestForecastPayload(
  url: string,
  parentSignal?: AbortSignal,
): Promise<OpenMeteoResponse[]> {
  for (let attempt = 0; attempt < WEATHER_REQUEST_ATTEMPTS; attempt += 1) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), WEATHER_REQUEST_TIMEOUT_MS);
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, abortController.signal])
      : abortController.signal;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate: 60 * 15,
        },
        signal,
      });

      if (response.ok) {
        const payload = openMeteoPayloadSchema.safeParse(await response.json());
        const responses = payload.success
          ? (Array.isArray(payload.data) ? payload.data : [payload.data])
          : [];

        if (
          !payload.success ||
          responses.some((item) => !item.hourly?.time?.length)
        ) {
          throw new WeatherProviderError(
            "WEATHER_PROVIDER_INVALID_RESPONSE",
            "The forecast provider returned an incomplete response.",
          );
        }

        return responses as OpenMeteoResponse[];
      }

      const isTransient = response.status === 429 || response.status >= 500;

      if (!isTransient || attempt === WEATHER_REQUEST_ATTEMPTS - 1) {
        throw new WeatherProviderError(
          "WEATHER_PROVIDER_UNAVAILABLE",
          "Forecast conditions are temporarily unavailable.",
        );
      }
    } catch (error) {
      if (parentSignal?.aborted) {
        throw parentSignal.reason ?? error;
      }

      if (error instanceof WeatherProviderError) {
        throw error;
      }

      if (attempt === WEATHER_REQUEST_ATTEMPTS - 1) {
        const timedOut = error instanceof Error && error.name === "AbortError";
        throw new WeatherProviderError(
          timedOut ? "WEATHER_PROVIDER_TIMEOUT" : "WEATHER_PROVIDER_UNAVAILABLE",
          timedOut
            ? "The forecast provider took too long to respond."
            : "Forecast conditions are temporarily unavailable.",
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    await waitForRetry(attempt);
  }

  throw new WeatherProviderError(
    "WEATHER_PROVIDER_UNAVAILABLE",
    "Forecast conditions are temporarily unavailable.",
  );
}

function buildForecastParams(coordinates: Coordinate[], forecastDays: number) {
  return new URLSearchParams({
    latitude: coordinates.map((coordinate) => coordinate.lat.toFixed(4)).join(","),
    longitude: coordinates.map((coordinate) => coordinate.lon.toFixed(4)).join(","),
    timezone: "auto",
    forecast_days: String(forecastDays),
    hourly: [
      "temperature_2m",
      "precipitation",
      "snowfall",
      "visibility",
      "wind_speed_10m",
      "wind_gusts_10m",
      "weather_code",
      "is_day",
    ].join(","),
  });
}

function normalizeForecastSeries(payload: OpenMeteoResponse): ForecastSeries {
  const timezone = payload.timezone ?? "UTC";
  const times = payload.hourly?.time ?? [];
  const rows: ForecastRow[] = times.map((time, index) => ({
    timeUtc: fromZonedTime(time, timezone).toISOString(),
    temperatureC: payload.hourly?.temperature_2m?.[index] ?? null,
    precipitationMm: payload.hourly?.precipitation?.[index] ?? null,
    snowfallCm: payload.hourly?.snowfall?.[index] ?? null,
    visibilityKm:
      typeof payload.hourly?.visibility?.[index] === "number"
        ? (payload.hourly?.visibility?.[index] ?? 0) / 1000
        : null,
    windSpeedKph: payload.hourly?.wind_speed_10m?.[index] ?? null,
    windGustKph: payload.hourly?.wind_gusts_10m?.[index] ?? null,
    weatherCode: payload.hourly?.weather_code?.[index] ?? null,
    isDay:
      typeof payload.hourly?.is_day?.[index] === "number"
        ? payload.hourly?.is_day?.[index] === 1
        : null,
  }));

  return {
    timezone,
    rows,
  };
}

function chunkEntries<T>(items: T[], size: number) {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );
}

async function fetchForecastBatches(
  entries: Array<[string, Coordinate]>,
  forecastDays: number,
  signal?: AbortSignal,
): Promise<Array<readonly [string, ForecastSeries | null]>> {
  const resolved = new Map<string, ForecastSeries | null>();
  let firstProviderError: WeatherProviderError | null = null;
  const pending: Array<[string, Coordinate]> = [];
  const waiting: Array<[string, Promise<ForecastSeries>]> = [];

  for (const [key, coordinate] of entries) {
    const cacheKey = `${key}:${forecastDays}`;
    const cached = getCachedValue(forecastCache, cacheKey);

    if (cached) {
      resolved.set(key, cached);
      continue;
    }

    const inFlight = inFlightForecasts.get(cacheKey);
    if (inFlight) {
      waiting.push([key, inFlight]);
    } else {
      pending.push([key, coordinate]);
    }
  }

  await Promise.all(
    waiting.map(async ([key, request]) => {
      try {
        resolved.set(key, await request);
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason ?? error;
        }
        if (error instanceof WeatherProviderError && !firstProviderError) {
          firstProviderError = error;
        }
        resolved.set(key, null);
      }
    }),
  );

  const chunks = chunkEntries(pending, WEATHER_BATCH_SIZE);
  const chunkResults = await runWithConcurrency(
    chunks,
    WEATHER_BATCH_CONCURRENCY,
    async (chunk) => {
      if (chunk.length === 0) {
        return [] as Array<readonly [string, ForecastSeries | null]>;
      }

      const batchRequest = requestForecastPayload(
        `${OPEN_METEO_URL}?${buildForecastParams(
          chunk.map(([, coordinate]) => coordinate),
          forecastDays,
        )}`,
        signal,
      ).then((payloads) => {
        if (payloads.length !== chunk.length) {
          throw new WeatherProviderError(
            "WEATHER_PROVIDER_INVALID_RESPONSE",
            "The forecast provider returned an incomplete batch.",
          );
        }

        return payloads.map(normalizeForecastSeries);
      });
      const perKeyRequests = chunk.map(([key], index) => {
        const request = batchRequest.then((series) => series[index]);
        inFlightForecasts.set(`${key}:${forecastDays}`, request);
        return request;
      });

      try {
        const series = await Promise.all(perKeyRequests);
        return chunk.map(([key], index) => {
          setCachedValue(
            forecastCache,
            `${key}:${forecastDays}`,
            WEATHER_TTL_MS,
            series[index],
          );
          return [key, series[index]] as const;
        });
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason ?? error;
        }

        if (error instanceof WeatherProviderError && !firstProviderError) {
          firstProviderError = error;
        }

        return chunk.map(([key]) => [key, null] as const);
      } finally {
        chunk.forEach(([key]) => inFlightForecasts.delete(`${key}:${forecastDays}`));
      }
    },
  );

  chunkResults.flat().forEach(([key, series]) => resolved.set(key, series));

  if (
    firstProviderError &&
    entries.length > 0 &&
    entries.every(([key]) => !resolved.get(key))
  ) {
    throw firstProviderError;
  }

  return entries.map(([key]) => [key, resolved.get(key) ?? null] as const);
}

function createUnavailableSnapshot(pointTimeZone: string): WeatherMatch {
  const baseWeather = {
    temperatureC: null,
    precipitationMm: null,
    snowfallCm: null,
    visibilityKm: null,
    windSpeedKph: null,
    windGustKph: null,
    weatherCode: null,
    isDay: null,
    condition: "Forecast unavailable",
    matchedHourUtc: null,
    matchDistanceMinutes: null,
    source: "unavailable" as const,
  };

  return {
    pointTimeZone,
    weather: {
      ...baseWeather,
      summary: buildWeatherSummary(baseWeather),
    },
  };
}

function matchForecastToEta(series: ForecastSeries, etaUtc: string): WeatherMatch {
  const etaTime = new Date(etaUtc).getTime();
  let bestRow: ForecastRow | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const row of series.rows) {
    const distance = Math.abs(new Date(row.timeUtc).getTime() - etaTime);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestRow = row;
    }
  }

  if (!bestRow || bestDistance > MAX_MATCH_DISTANCE_MS) {
    return createUnavailableSnapshot(series.timezone);
  }

  const source: "exact" | "nearest" =
    bestDistance <= 1000 * 60 * 30 ? "exact" : "nearest";
  const weatherWithoutSummary = {
    temperatureC: bestRow.temperatureC,
    precipitationMm: bestRow.precipitationMm,
    snowfallCm: bestRow.snowfallCm,
    visibilityKm: bestRow.visibilityKm,
    windSpeedKph: bestRow.windSpeedKph,
    windGustKph: bestRow.windGustKph,
    weatherCode: bestRow.weatherCode,
    isDay: bestRow.isDay,
    condition: describeWeatherCode(bestRow.weatherCode),
    matchedHourUtc: bestRow.timeUtc,
    matchDistanceMinutes: Math.round(bestDistance / (1000 * 60)),
    source,
  };

  return {
    pointTimeZone: series.timezone,
    weather: {
      ...weatherWithoutSummary,
      summary: buildWeatherSummary(weatherWithoutSummary),
    },
  };
}

async function runWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function consumeQueue() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(limit, items.length),
    },
    () => consumeQueue(),
  );

  await Promise.all(workers);

  return results;
}

export async function resolveWeatherForSamples(
  samples: WeatherSampleInput[],
  signal?: AbortSignal,
) {
  if (samples.length === 0) {
    return [];
  }

  const etaTimes = samples.map((sample) => new Date(sample.etaUtc));
  const firstEta = etaTimes.reduce((earliest, current) =>
    current < earliest ? current : earliest,
  );
  const lastEta = etaTimes.reduce((latest, current) =>
    current > latest ? current : latest,
  );
  const forecastDays = clamp(
    Math.max(
      differenceInCalendarDays(lastEta, new Date()) + 2,
      differenceInCalendarDays(lastEta, firstEta) + 2,
    ),
    1,
    16,
  );

  const buckets = new Map<string, Coordinate>();

  for (const sample of samples) {
    const bucketCoordinate = {
      lat: Number(sample.coordinate.lat.toFixed(2)),
      lon: Number(sample.coordinate.lon.toFixed(2)),
    };

    buckets.set(getBucketKey(bucketCoordinate), bucketCoordinate);
  }

  const forecastEntries = Array.from(buckets.entries());
  const forecasts = await fetchForecastBatches(forecastEntries, forecastDays, signal);
  const forecastMap = new Map(forecasts);
  const matchCache = new Map<string, WeatherMatch>();

  if (forecasts.length > 0 && forecasts.every(([, forecast]) => forecast === null)) {
    throw new WeatherProviderError(
      "WEATHER_PROVIDER_UNAVAILABLE",
      "Forecast conditions are temporarily unavailable along the route.",
    );
  }

  return samples.map((sample) => {
    const bucketCoordinate = {
      lat: Number(sample.coordinate.lat.toFixed(2)),
      lon: Number(sample.coordinate.lon.toFixed(2)),
    };
    const bucketKey = getBucketKey(bucketCoordinate);
    const hourKey = `${bucketKey}:${sample.etaUtc.slice(0, 13)}`;
    const cachedMatch = matchCache.get(hourKey);

    if (cachedMatch) {
      return cachedMatch;
    }

    const forecast = forecastMap.get(bucketKey);

    if (!forecast) {
      const unavailable = createUnavailableSnapshot("UTC");
      matchCache.set(hourKey, unavailable);
      return unavailable;
    }

    const match = matchForecastToEta(forecast, sample.etaUtc);
    matchCache.set(hourKey, match);
    return match;
  });
}
