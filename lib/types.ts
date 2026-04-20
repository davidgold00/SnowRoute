import { z } from "zod";

export const locationSchema = z.object({
  label: z.string().trim().min(1).max(140),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const geocodeQuerySchema = z.object({
  query: z.string().trim().min(2).max(120),
});

export const analyzeRouteInputSchema = z.object({
  origin: locationSchema,
  destination: locationSchema,
  waypoints: z.array(locationSchema).max(8).optional().default([]),
  departureTimeUtc: z.string().datetime({ offset: true }),
  clientTimeZone: z.string().trim().min(1),
});

export type Coordinate = {
  lat: number;
  lon: number;
};

export type LocationSuggestion = Coordinate & {
  id: string;
  label: string;
  country: string | null;
  region: string | null;
};

export type AnalyzeRouteInput = z.infer<typeof analyzeRouteInputSchema>;

export type RiskLabel = "Low" | "Moderate" | "High" | "Severe";

export type Recommendation =
  | "Safe"
  | "Use caution"
  | "Delay recommended"
  | "Avoid travel";

export type RiskFactor = {
  key: string;
  label: string;
  contribution: number;
};

export type WeatherMatchSource = "exact" | "nearest" | "unavailable";

export type NormalizedWeatherSnapshot = {
  temperatureC: number | null;
  precipitationMm: number | null;
  snowfallCm: number | null;
  visibilityKm: number | null;
  windSpeedKph: number | null;
  windGustKph: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
  condition: string;
  summary: string;
  matchedHourUtc: string | null;
  matchDistanceMinutes: number | null;
  source: WeatherMatchSource;
};

export type RouteSample = {
  id: string;
  coordinate: Coordinate;
  distanceKm: number;
  etaUtc: string;
  etaDisplay: string;
  pointTimeZone: string;
  weather: NormalizedWeatherSnapshot;
  score: number;
  label: RiskLabel;
  explanationFactors: string[];
  factors: RiskFactor[];
};

export type HazardWindow = {
  id: string;
  startEtaUtc: string;
  endEtaUtc: string;
  startEtaDisplay: string;
  endEtaDisplay: string;
  maxScore: number;
  label: Extract<RiskLabel, "High" | "Severe">;
  dominantFactors: string[];
  sampleIds: string[];
};

export type RouteSegment = {
  id: string;
  coordinates: Coordinate[];
  score: number;
  label: RiskLabel;
  fromSampleId: string;
  toSampleId: string;
};

export type DataQuality = {
  missingSnowfallSamples: number;
  missingVisibilitySamples: number;
  fallbackMatches: number;
  unmatchedSamples: number;
  incompleteWeatherSamples: number;
};

export type RouteSummary = {
  overallScore: number;
  overallLabel: RiskLabel;
  recommendation: Recommendation;
  worstSegmentId: string | null;
  averageScore: number;
  maxScore: number;
  dataQuality: DataQuality;
};

export type RouteAnalysisResponse = {
  route: {
    coordinates: Coordinate[];
    distanceKm: number;
    durationMinutes: number;
    segments: RouteSegment[];
  };
  samples: RouteSample[];
  hazardWindows: HazardWindow[];
  summary: RouteSummary;
};
