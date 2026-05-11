import "server-only";

import { differenceInCalendarDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

import type { Coordinate, NormalizedWeatherSnapshot } from "@/lib/types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_TTL_MS = 1000 * 60 * 15;
const MAX_MATCH_DISTANCE_MS = 1000 * 60 * 60 * 2;

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

type WeatherMatch = {
  pointTimeZone: string;
  weather: NormalizedWeatherSnapshot;
};

type WeatherSampleInput = {
  coordinate: Coordinate;
  etaUtc: string;
};

const forecastCache = new Map<string, CacheEntry<ForecastSeries>>();

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

  return WEATHER_CODE_LABELS[code] ?? "Mixed winter conditions";
}

async function fetchForecastSeries(
  coordinate: Coordinate,
  forecastDays: number,
): Promise<ForecastSeries> {
  const bucketKey = `${getBucketKey(coordinate)}:${forecastDays}`;
  const cached = getCachedValue(forecastCache, bucketKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    latitude: coordinate.lat.toFixed(4),
    longitude: coordinate.lon.toFixed(4),
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

  const response = await fetch(`${OPEN_METEO_URL}?${params}`, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 60 * 15,
    },
  });

  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
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

  const series = {
    timezone,
    rows,
  };

  setCachedValue(forecastCache, bucketKey, WEATHER_TTL_MS, series);

  return series;
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

export async function resolveWeatherForSamples(samples: WeatherSampleInput[]) {
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
  const forecasts = await runWithConcurrency(forecastEntries, 6, async ([key, coordinate]) => {
    const forecast = await fetchForecastSeries(coordinate, forecastDays);
    return [key, forecast] as const;
  });
  const forecastMap = new Map(forecasts);
  const matchCache = new Map<string, WeatherMatch>();

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
