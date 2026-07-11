import { z } from "zod";

export const locationSchema = z.object({
  label: z.string().trim().min(1).max(240),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const geocodeQuerySchema = z.object({
  query: z.string().trim().min(2).max(200),
});

export const locationBoundingBoxSchema = z
  .object({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .refine((bounds) => bounds.south <= bounds.north, {
    message: "The southern boundary must not exceed the northern boundary.",
  });

export const cityPrecisionSchema = z.enum([
  "city",
  "municipality",
  "town",
  "village",
  "locality",
]);

export const placeTypeSchema = z.enum([
  "address",
  "street",
  "business",
  "landmark",
  "airport",
  "transit",
  "postal",
  "coordinates",
  "unknown",
]);

export const placePrecisionSchema = z.enum([
  "rooftop",
  "parcel",
  "entrance",
  "street",
  "intersection",
  "postal",
  "approximate",
  "unknown",
]);

export const cityRelationshipSchema = z.enum([
  "WITHIN_SELECTED_CITY",
  "NEAR_SELECTED_CITY",
  "OUTSIDE_SELECTED_CITY",
  "CITY_MEMBERSHIP_UNKNOWN",
]);

const optionalLocationText = z.string().trim().min(1).max(240).nullish();
const optionalProviderId = z.string().trim().min(1).max(240).nullish();
const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,3}$/)
  .transform((value) => value.toUpperCase());

export const citySelectionSchema = z.object({
  providerId: optionalProviderId,
  displayName: z.string().trim().min(1).max(240),
  cityName: z.string().trim().min(1).max(160),
  regionName: optionalLocationText,
  regionCode: z.string().trim().min(1).max(32).nullish(),
  countryName: z.string().trim().min(1).max(160),
  countryCode: countryCodeSchema,
  postalCode: z.string().trim().min(1).max(32).nullish(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  boundingBox: locationBoundingBoxSchema.nullish(),
  timezone: z.string().trim().min(1).max(120).nullish(),
  precision: cityPrecisionSchema,
  providerConfidence: z.number().min(0).max(1).nullish(),
});

export const placeSelectionSchema = z.object({
  providerId: optionalProviderId,
  displayName: z.string().trim().min(1).max(240),
  formattedAddress: z.string().trim().min(1).max(320),
  primaryText: z.string().trim().min(1).max(180),
  secondaryText: optionalLocationText,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeType: placeTypeSchema,
  precision: placePrecisionSchema,
  cityName: optionalLocationText,
  regionName: optionalLocationText,
  countryCode: countryCodeSchema.nullish(),
  postalCode: z.string().trim().min(1).max(32).nullish(),
  cityRelationship: cityRelationshipSchema,
  providerConfidence: z.number().min(0).max(1).nullish(),
  matchType: z.string().trim().min(1).max(80).nullish(),
  source: z.string().trim().min(1).max(80).nullish(),
});

export const routeEndpointSelectionSchema = z.object({
  city: citySelectionSchema,
  place: placeSelectionSchema.nullish(),
  effectiveLatitude: z.number().min(-90).max(90),
  effectiveLongitude: z.number().min(-180).max(180),
  effectiveDisplayName: z.string().trim().min(1).max(240),
  effectiveFormattedAddress: z.string().trim().min(1).max(320),
  usesCityFallback: z.boolean(),
});

export const effectiveRouteEndpointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  displayName: z.string().trim().min(1).max(240),
  formattedAddress: z.string().trim().min(1).max(320),
  placeType: placeTypeSchema,
  precision: z.union([cityPrecisionSchema, placePrecisionSchema]),
  usesCityFallback: z.boolean(),
});

export const effectiveRouteEndpointsSchema = z.object({
  origin: effectiveRouteEndpointSchema,
  destination: effectiveRouteEndpointSchema,
});

export const citySearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(120),
  countryCode: countryCodeSchema.optional(),
});

export const placeSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(160),
  city: citySelectionSchema,
  includeNearby: z.boolean().optional(),
});

export const analyzeRouteInputSchema = z.object({
  origin: locationSchema,
  destination: locationSchema,
  effectiveEndpoints: effectiveRouteEndpointsSchema.optional(),
  sameCity: z.boolean().optional().default(false),
  waypoints: z.array(locationSchema).max(2).optional().default([]),
  departureTimeUtc: z.string().datetime({ offset: true }),
  clientTimeZone: z.string().trim().min(1),
});

export type Coordinate = {
  lat: number;
  lon: number;
};

export type LocationType =
  | "address"
  | "business"
  | "street"
  | "city"
  | "postal"
  | "region"
  | "landmark"
  | "coordinates"
  | "unknown";

export type LocationPrecision =
  | "rooftop"
  | "parcel"
  | "street"
  | "postal"
  | "city"
  | "region"
  | "unknown";

export type LocationSuggestion = Coordinate & {
  id: string;
  providerId?: string | null;
  label: string;
  formattedAddress?: string;
  primaryLabel?: string;
  locality?: string | null;
  country: string | null;
  countryCode?: string | null;
  region: string | null;
  postalCode?: string | null;
  detail: string | null;
  placeType: "Address" | "Place" | "Street" | "City" | "Region";
  locationType?: LocationType;
  precision?: LocationPrecision;
  isApproximate?: boolean;
  providerConfidence?: number | null;
};

export type LocationBoundingBox = z.infer<typeof locationBoundingBoxSchema>;
export type CityPrecision = z.infer<typeof cityPrecisionSchema>;
export type PlaceType = z.infer<typeof placeTypeSchema>;
export type PlacePrecision = z.infer<typeof placePrecisionSchema>;
export type CityRelationship = z.infer<typeof cityRelationshipSchema>;
export type CitySelection = z.infer<typeof citySelectionSchema>;
export type PlaceSelection = z.infer<typeof placeSelectionSchema>;
export type RouteEndpointSelection = z.infer<typeof routeEndpointSelectionSchema>;
export type EffectiveRouteEndpoint = z.infer<typeof effectiveRouteEndpointSchema>;
export type EffectiveRouteEndpoints = z.infer<typeof effectiveRouteEndpointsSchema>;
export type CitySearchRequest = z.infer<typeof citySearchRequestSchema>;
export type PlaceSearchRequest = z.infer<typeof placeSearchRequestSchema>;

export type CitySearchResponseData = {
  results: CitySelection[];
};

export type PlaceSearchResponseData = {
  results: PlaceSelection[];
  nearbyResults: PlaceSelection[];
  normalizedQuery: string;
  unitRoutingNote: string | null;
};

export type LocationSearchCacheStatus = "hit" | "miss" | "coalesced";

export type AnalyzeRouteInput = z.infer<typeof analyzeRouteInputSchema>;

export type RiskLabel = "Low" | "Moderate" | "High" | "Severe";

export type TripDecisionLevel = "GO" | "CAUTION" | "DELAY" | "HOLD" | "AVOID";

export type ForecastConfidence = "High" | "Medium" | "Low";

export type Recommendation =
  | "Lower risk"
  | "Use caution"
  | "Delay recommended"
  | "Avoid travel";

export type RiskGuidance = {
  headline: string;
  impact: string;
  gamePlan: string;
};

export type RiskFactor = {
  key: string;
  label: string;
  contribution: number;
};

export type HazardType =
  | "snow"
  | "heavy_snow"
  | "blowing_snow"
  | "freezing_rain"
  | "freezing_drizzle"
  | "possible_icing"
  | "fog"
  | "low_visibility"
  | "heavy_rain"
  | "hydroplaning_risk"
  | "high_wind"
  | "thunderstorm"
  | "severe_thunderstorm"
  | "hail"
  | "extreme_cold"
  | "extreme_heat"
  | "night_compounding"
  | "compound_hazard"
  | "data_uncertainty";

export type HazardSeverity = "MINOR" | "MODERATE" | "MAJOR" | "EXTREME";

export type HazardConfidence = "HIGH" | "MEDIUM" | "LOW";

export type HazardFinding = {
  type: HazardType;
  severity: HazardSeverity;
  scoreContribution: number;
  title: string;
  explanation: string;
  source: string;
  observedOrForecast: "FORECAST" | "INFERRED";
  confidence: HazardConfidence;
  rawValue?: number | string;
  units?: string;
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
  hazards?: HazardFinding[];
  hazardConfidence?: HazardConfidence;
  hazardConfidenceReasons?: string[];
  guidance: RiskGuidance;
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
  guidance: RiskGuidance;
  sampleIds: string[];
  startSampleIndex: number;
  endSampleIndex: number;
  approximateLocationLabel: string;
  summary: string;
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
  guidance: RiskGuidance;
};

export type DepartureTimeOption = {
  id: string;
  hour: number;
  departureTimeUtc: string;
  departureTimeDisplay: string;
  hourLabel: string;
  safetyScore: number;
  overallScore: number;
  averageScore: number;
  maxScore: number;
  label: RiskLabel;
  recommendation: Recommendation;
  hazardWindowCount: number;
  severeWindowCount: number;
  forecastCoverageRatio: number;
  dataQuality: DataQuality;
  isSelectedHour: boolean;
  guidance: RiskGuidance;
};

export type DepartureOptimization = {
  travelDateDisplay: string;
  summary: string;
  isEquallySafe: boolean;
  bestOptionIds: string[];
  bestDepartureTimeDisplays: string[];
  options: DepartureTimeOption[];
};

export type DecisionDangerWindow = {
  id: string;
  startTime: string;
  endTime: string;
  approximateLocationLabel: string;
  segmentIndexStart: number;
  segmentIndexEnd: number;
  maxRisk: Extract<RiskLabel, "High" | "Severe">;
  hazardTypes: string[];
  summary: string;
};

export type HoldRecommendation = {
  shouldHold: boolean;
  holdBeforeLocationLabel: string;
  holdBeforeSegmentIndex: number;
  estimatedArrivalTime: string;
  dangerBeginsAround: string;
  reason: string;
  resumeWindow: string | null;
  riskIfContinuing: Extract<RiskLabel, "High" | "Severe">;
};

export type SaferDepartureWindow = {
  id: string;
  departureTimeUtc: string;
  departureTime: string;
  decision: TripDecisionLevel;
  overallRisk: RiskLabel;
  worstSegmentRisk: RiskLabel;
  summary: string;
  improvementComparedToSelected: string | null;
};

export type TripDecision = {
  decision: TripDecisionLevel;
  decisionLabel: string;
  decisionSummary: string;
  confidence: ForecastConfidence;
  confidenceReasons: string[];
  overallRisk: RiskLabel;
  worstSegmentRisk: RiskLabel;
  worstSegmentLocationLabel: string;
  worstSegmentArrivalTime: string;
  mainHazards: string[];
  dangerWindows: DecisionDangerWindow[];
  holdRecommendation: HoldRecommendation | null;
  saferDepartureWindows: SaferDepartureWindow[];
  explanationBullets: string[];
  dataQualityNotes: string[];
  safetyDisclaimer: string;
};

export type AnalysisMetadata = {
  analyzedAt: string;
  analysisVersion: string;
  riskModelVersion: string;
  weatherProvider: string;
  routeProvider: string;
  geocoderProvider: string;
};

export type RouteAnalysisResponse = {
  metadata: AnalysisMetadata;
  route: {
    coordinates: Coordinate[];
    distanceKm: number;
    durationMinutes: number;
    segments: RouteSegment[];
  };
  samples: RouteSample[];
  hazardWindows: HazardWindow[];
  summary: RouteSummary;
  departureOptimization: DepartureOptimization;
  tripDecision: TripDecision;
};
