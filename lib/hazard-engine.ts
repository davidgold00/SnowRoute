import { formatInTimeZone } from "date-fns-tz";

import type {
  AnalysisMetadata,
  HazardConfidence,
  HazardFinding,
  NormalizedWeatherSnapshot,
  RiskFactor,
  RiskLabel,
} from "@/lib/types";

export const RISK_MODEL_VERSION = "risk-model-2.0.0";
export const ANALYSIS_VERSION = "route-analysis-2.0.0";

export const HAZARD_THRESHOLDS = {
  snowCmPerHour: {
    signal: 0.15,
    steady: 0.75,
    heavy: 2,
    intense: 4,
  },
  visibilityKm: {
    reduced: 4.8,
    low: 1.6,
    veryLow: 0.8,
    nearZero: 0.4,
  },
  windKph: {
    caution: 48,
    strong: 64,
    damaging: 80,
  },
  rainMmPerHour: {
    heavy: 7.5,
    veryHeavy: 15,
  },
  icing: {
    precipitationSignalMm: 0.1,
    minimumTemperatureC: -6,
    maximumTemperatureC: 2,
  },
  temperatureC: {
    veryCold: -20,
    extremeCold: -30,
    exceptionalCold: -40,
    veryHot: 35,
    extremeHeat: 40,
    exceptionalHeat: 45,
  },
  riskScore: {
    moderate: 25,
    high: 50,
    severe: 75,
  },
} as const;

export type HazardEngineResult = {
  hazards: HazardFinding[];
  riskScore: number;
  riskLevel: RiskLabel;
  confidence: HazardConfidence;
  confidenceReasons: string[];
  factors: RiskFactor[];
  explanationFactors: string[];
};

type ScoredFinding = HazardFinding & {
  family: "snow" | "ice" | "visibility" | "wind" | "rain" | "storm" | "temperature" | "context";
  factorKey: string;
  scoreFloor?: number;
};

const FORECAST_SOURCE = "Open-Meteo hourly forecast";
const INFERENCE_SOURCE = "SnowRoute inference from normalized Open-Meteo fields";
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const HEAVY_SNOW_CODES = new Set([75, 86]);
const FREEZING_DRIZZLE_CODES = new Set([56, 57]);
const FREEZING_RAIN_CODES = new Set([66, 67]);
const HEAVY_RAIN_CODES = new Set([65, 81, 82]);
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scale(value: number, minimum: number, maximum: number, cap: number) {
  if (value <= minimum) {
    return 0;
  }

  if (value >= maximum) {
    return cap;
  }

  return ((value - minimum) / (maximum - minimum)) * cap;
}

function codeIs(code: number | null, codes: Set<number>) {
  return code !== null && codes.has(code);
}

function directConfidence(weather: NormalizedWeatherSnapshot): HazardConfidence {
  return weather.source === "exact"
    ? "HIGH"
    : weather.source === "nearest"
      ? "MEDIUM"
      : "LOW";
}

function inferredConfidence(weather: NormalizedWeatherSnapshot): HazardConfidence {
  return weather.source === "exact" ? "MEDIUM" : "LOW";
}

function finding(
  values: ScoredFinding,
): ScoredFinding {
  return values;
}

function toPublicFinding(item: ScoredFinding): HazardFinding {
  return {
    type: item.type,
    severity: item.severity,
    scoreContribution: item.scoreContribution,
    title: item.title,
    explanation: item.explanation,
    source: item.source,
    observedOrForecast: item.observedOrForecast,
    confidence: item.confidence,
    ...(item.rawValue === undefined ? {} : { rawValue: item.rawValue }),
    ...(item.units === undefined ? {} : { units: item.units }),
  };
}

function detectSnow(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const precipitationMm = weather.precipitationMm ?? 0;
  const snowfallCm =
    weather.snowfallCm ??
    (codeIs(weather.weatherCode, SNOW_CODES) ? precipitationMm * 0.8 : 0);
  const hasSnow =
    snowfallCm > HAZARD_THRESHOLDS.snowCmPerHour.signal ||
    codeIs(weather.weatherCode, SNOW_CODES);

  if (!hasSnow) {
    return [];
  }

  const heavySignal =
    snowfallCm >= HAZARD_THRESHOLDS.snowCmPerHour.heavy ||
    codeIs(weather.weatherCode, HEAVY_SNOW_CODES);
  const contribution = Math.round(
    Math.max(
      scale(
        snowfallCm,
        HAZARD_THRESHOLDS.snowCmPerHour.signal,
        HAZARD_THRESHOLDS.snowCmPerHour.intense,
        45,
      ),
      heavySignal ? 28 : 12,
    ),
  );
  const title =
    snowfallCm >= HAZARD_THRESHOLDS.snowCmPerHour.intense
      ? "Intense snowfall can overwhelm plowing and lane tracking"
      : heavySignal
        ? "Heavy snowfall expected"
        : snowfallCm >= HAZARD_THRESHOLDS.snowCmPerHour.steady
          ? "Steady snowfall expected"
          : "Light snow along this segment";

  return [
    finding({
      type: heavySignal ? "heavy_snow" : "snow",
      severity:
        snowfallCm >= HAZARD_THRESHOLDS.snowCmPerHour.intense
          ? "EXTREME"
          : heavySignal
            ? "MAJOR"
            : snowfallCm >= HAZARD_THRESHOLDS.snowCmPerHour.steady
              ? "MODERATE"
              : "MINOR",
      scoreContribution: contribution,
      title,
      explanation:
        "Hourly snowfall can cover lane markings, reduce tire grip, and increase stopping distance before treatment catches up.",
      source: FORECAST_SOURCE,
      observedOrForecast: "FORECAST",
      confidence: directConfidence(weather),
      rawValue: Number(snowfallCm.toFixed(2)),
      units: "cm/h",
      family: "snow",
      factorKey: "snowfall",
    }),
  ];
}

function detectIce(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const code = weather.weatherCode;
  const temperatureC = weather.temperatureC;
  const precipitationMm = weather.precipitationMm ?? 0;

  if (codeIs(code, FREEZING_DRIZZLE_CODES)) {
    const heavy = code === 57;
    return [
      finding({
        type: "freezing_drizzle",
        severity: heavy ? "EXTREME" : "MAJOR",
        scoreContribution: heavy ? 42 : 34,
        title: heavy
          ? "Dense freezing drizzle can rapidly glaze road surfaces"
          : "Freezing drizzle can glaze untreated pavement",
        explanation:
          "The forecast weather code indicates freezing drizzle; even light liquid accumulation can reduce braking and steering control.",
        source: FORECAST_SOURCE,
        observedOrForecast: "FORECAST",
        confidence: directConfidence(weather),
        rawValue: code ?? undefined,
        units: "WMO code",
        family: "ice",
        factorKey: "freezing-precipitation",
      }),
    ];
  }

  if (codeIs(code, FREEZING_RAIN_CODES)) {
    const heavy = code === 67;
    return [
      finding({
        type: "freezing_rain",
        severity: heavy ? "EXTREME" : "MAJOR",
        scoreContribution: heavy ? 50 : 42,
        title: heavy
          ? "Heavy freezing rain is dangerous for ordinary travel"
          : "Freezing rain can make braking and steering unreliable",
        explanation:
          "The forecast weather code indicates freezing rain, which can glaze untreated pavement without a visible snow layer.",
        source: FORECAST_SOURCE,
        observedOrForecast: "FORECAST",
        confidence: directConfidence(weather),
        rawValue: code ?? undefined,
        units: "WMO code",
        family: "ice",
        factorKey: "freezing-precipitation",
      }),
    ];
  }

  if (
    typeof temperatureC !== "number" ||
    precipitationMm <= HAZARD_THRESHOLDS.icing.precipitationSignalMm ||
    temperatureC < HAZARD_THRESHOLDS.icing.minimumTemperatureC ||
    temperatureC > HAZARD_THRESHOLDS.icing.maximumTemperatureC
  ) {
    return [];
  }

  const temperatureProximity =
    1 - Math.min(Math.abs(temperatureC - 0.5) / 6.5, 1);
  const precipitationIntensity = Math.min(Math.max(precipitationMm, 0.4) / 3, 1);
  const contribution = clamp(
    Math.round(15 + temperatureProximity * 10 + precipitationIntensity * 10),
    0,
    35,
  );

  return [
    finding({
      type: "possible_icing",
      severity: contribution >= 30 ? "MAJOR" : "MODERATE",
      scoreContribution: contribution,
      title: "Temperature near freezing increases possible road-icing risk",
      explanation:
        "Moisture and near-freezing air can support slick pavement, especially on bridges, ramps, shaded areas, and untreated roads. This is a proxy, not a road-surface observation.",
      source: INFERENCE_SOURCE,
      observedOrForecast: "INFERRED",
      confidence: inferredConfidence(weather),
      rawValue: Number(temperatureC.toFixed(1)),
      units: "°C",
      family: "ice",
      factorKey: "icing",
    }),
  ];
}

function visibilityContribution(visibilityKm: number) {
  if (visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero) {
    return 40;
  }

  if (visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.veryLow) {
    return 30;
  }

  if (visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.low) {
    return 20;
  }

  return visibilityKm < HAZARD_THRESHOLDS.visibilityKm.reduced ? 10 : 0;
}

function detectVisibility(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const visibilityKm = weather.visibilityKm;
  const fogCode = weather.weatherCode === 45 || weather.weatherCode === 48;
  const measuredContribution =
    typeof visibilityKm === "number" ? visibilityContribution(visibilityKm) : 0;
  const codeContribution = weather.weatherCode === 48 ? 12 : fogCode ? 8 : 0;
  const contribution = Math.max(measuredContribution, codeContribution);

  if (contribution === 0) {
    return [];
  }

  const title =
    typeof visibilityKm === "number" &&
    visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero
      ? "Near-whiteout or dense fog visibility"
      : typeof visibilityKm === "number" &&
          visibilityKm < HAZARD_THRESHOLDS.visibilityKm.low
        ? "Low visibility conditions"
        : fogCode
          ? weather.weatherCode === 48
            ? "Dense fog can sharply reduce reaction distance"
            : "Fog signal in forecast"
          : "Reduced visibility expected";

  return [
    finding({
      type: fogCode ? "fog" : "low_visibility",
      severity:
        contribution >= 40
          ? "EXTREME"
          : contribution >= 30
            ? "MAJOR"
            : contribution >= 20
              ? "MODERATE"
              : "MINOR",
      scoreContribution: contribution,
      title,
      explanation:
        "Reduced visibility shortens available reaction distance and can hide stopped traffic, lane boundaries, and rapidly changing conditions.",
      source: FORECAST_SOURCE,
      observedOrForecast: "FORECAST",
      confidence: directConfidence(weather),
      rawValue:
        typeof visibilityKm === "number"
          ? Number(visibilityKm.toFixed(2))
          : weather.weatherCode ?? undefined,
      units: typeof visibilityKm === "number" ? "km" : "WMO code",
      family: "visibility",
      factorKey: "visibility",
    }),
  ];
}

function detectWind(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const windMetric = Math.max(weather.windGustKph ?? 0, weather.windSpeedKph ?? 0);

  if (windMetric < HAZARD_THRESHOLDS.windKph.caution) {
    return [];
  }

  const contribution =
    windMetric >= HAZARD_THRESHOLDS.windKph.damaging
      ? 28
      : windMetric >= HAZARD_THRESHOLDS.windKph.strong
        ? 18
        : 10;

  return [
    finding({
      type: "high_wind",
      severity:
        contribution >= 28 ? "MAJOR" : contribution >= 18 ? "MODERATE" : "MINOR",
      scoreContribution: contribution,
      title:
        windMetric >= HAZARD_THRESHOLDS.windKph.damaging
          ? "Very strong gusts can push vehicles out of lane"
          : windMetric >= HAZARD_THRESHOLDS.windKph.strong
            ? "Strong wind gusts could destabilize travel"
            : "Windy conditions may affect control",
      explanation:
        "Strong sustained wind or gusts can cause abrupt lane movement, especially for high-profile vehicles, trailers, and exposed roadway sections.",
      source: FORECAST_SOURCE,
      observedOrForecast: "FORECAST",
      confidence: directConfidence(weather),
      rawValue: Number(windMetric.toFixed(1)),
      units: "km/h",
      family: "wind",
      factorKey: "wind",
    }),
  ];
}

function detectRain(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const precipitationMm = weather.precipitationMm ?? 0;
  const code = weather.weatherCode;
  const heavyCode = codeIs(code, HEAVY_RAIN_CODES);
  const hasHeavyRain =
    precipitationMm >= HAZARD_THRESHOLDS.rainMmPerHour.heavy || heavyCode;

  if (
    !hasHeavyRain ||
    codeIs(code, FREEZING_RAIN_CODES) ||
    codeIs(code, SNOW_CODES) ||
    (weather.snowfallCm ?? 0) > HAZARD_THRESHOLDS.snowCmPerHour.signal
  ) {
    return [];
  }

  const veryHeavy =
    precipitationMm >= HAZARD_THRESHOLDS.rainMmPerHour.veryHeavy || code === 82;
  const rainContribution = veryHeavy ? 36 : heavyCode ? 26 : 22;
  const findings: ScoredFinding[] = [
    finding({
      type: "heavy_rain",
      severity: veryHeavy ? "MAJOR" : "MODERATE",
      scoreContribution: rainContribution,
      title: veryHeavy
        ? "Very heavy rain can overwhelm visibility and drainage"
        : "Heavy rain can reduce traction and visibility",
      explanation:
        "Hourly rainfall intensity can reduce tire contact and obscure lane markings. It does not establish that any road is flooded.",
      source: FORECAST_SOURCE,
      observedOrForecast: "FORECAST" as const,
      confidence: directConfidence(weather),
      rawValue:
        precipitationMm > 0 ? Number(precipitationMm.toFixed(1)) : code ?? undefined,
      units: precipitationMm > 0 ? "mm/h" : "WMO code",
      family: "rain" as const,
      factorKey: "rain",
    }),
  ];

  if (precipitationMm >= HAZARD_THRESHOLDS.rainMmPerHour.heavy) {
    findings.push(
      finding({
        type: "hydroplaning_risk",
        severity: veryHeavy ? "MAJOR" : "MODERATE",
        scoreContribution: veryHeavy ? 18 : 12,
        title: "Rain intensity supports a hydroplaning-risk proxy",
        explanation:
          "Heavy hourly rain can increase hydroplaning risk at road speed. This inference does not indicate standing water or a flooded roadway.",
        source: INFERENCE_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: inferredConfidence(weather),
        rawValue: Number(precipitationMm.toFixed(1)),
        units: "mm/h",
        family: "rain",
        factorKey: "rain",
      }),
    );
  }

  return findings;
}

function detectStorm(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const code = weather.weatherCode;

  if (!codeIs(code, THUNDERSTORM_CODES)) {
    return [];
  }

  const values =
    code === 99
      ? {
          type: "severe_thunderstorm" as const,
          severity: "EXTREME" as const,
          contribution: 78,
          title: "Thunderstorm with heavy hail can make exposed travel unsafe",
        }
      : code === 96
        ? {
            type: "hail" as const,
            severity: "MAJOR" as const,
            contribution: 60,
            title: "Thunderstorm with hail can make travel erratic",
          }
        : {
            type: "thunderstorm" as const,
            severity: "MODERATE" as const,
            contribution: 40,
            title: "Thunderstorm activity can produce sudden hazards",
          };

  return [
    finding({
      type: values.type,
      severity: values.severity,
      scoreContribution: values.contribution,
      title: values.title,
      explanation:
        "The hourly weather code indicates convective weather that may bring abrupt visibility, wind, rain, or hail changes. No official warning is represented here.",
      source: FORECAST_SOURCE,
      observedOrForecast: "FORECAST",
      confidence: directConfidence(weather),
      rawValue: code ?? undefined,
      units: "WMO code",
      family: "storm",
      factorKey: "storm",
    }),
  ];
}

function detectTemperature(weather: NormalizedWeatherSnapshot): ScoredFinding[] {
  const temperatureC = weather.temperatureC;

  if (typeof temperatureC !== "number") {
    return [];
  }

  if (temperatureC <= HAZARD_THRESHOLDS.temperatureC.veryCold) {
    const exceptional = temperatureC <= HAZARD_THRESHOLDS.temperatureC.exceptionalCold;
    const extreme = temperatureC <= HAZARD_THRESHOLDS.temperatureC.extremeCold;
    return [
      finding({
        type: "extreme_cold",
        severity: exceptional ? "MAJOR" : extreme ? "MODERATE" : "MINOR",
        scoreContribution: exceptional ? 24 : extreme ? 18 : 10,
        title: exceptional
          ? "Exceptional cold increases breakdown and stranding exposure"
          : extreme
            ? "Extreme cold increases mechanical and stranding risk"
            : "Very cold conditions increase traveler exposure",
        explanation:
          "Air temperature alone does not establish unsafe pavement, but severe cold can affect batteries, tire pressure, and the consequences of a breakdown.",
        source: FORECAST_SOURCE,
        observedOrForecast: "FORECAST",
        confidence: directConfidence(weather),
        rawValue: Number(temperatureC.toFixed(1)),
        units: "°C",
        family: "temperature",
        factorKey: "temperature",
      }),
    ];
  }

  if (temperatureC >= HAZARD_THRESHOLDS.temperatureC.veryHot) {
    const exceptional = temperatureC >= HAZARD_THRESHOLDS.temperatureC.exceptionalHeat;
    const extreme = temperatureC >= HAZARD_THRESHOLDS.temperatureC.extremeHeat;
    return [
      finding({
        type: "extreme_heat",
        severity: exceptional ? "MAJOR" : extreme ? "MODERATE" : "MINOR",
        scoreContribution: exceptional ? 24 : extreme ? 18 : 10,
        title: exceptional
          ? "Exceptional heat increases vehicle and traveler stress"
          : extreme
            ? "Extreme heat increases tire and cooling-system stress"
            : "Very hot conditions increase heat exposure",
        explanation:
          "Air temperature alone does not make a route unsafe, but heat can amplify tire, cooling-system, and breakdown consequences.",
        source: FORECAST_SOURCE,
        observedOrForecast: "FORECAST",
        confidence: directConfidence(weather),
        rawValue: Number(temperatureC.toFixed(1)),
        units: "°C",
        family: "temperature",
        factorKey: "temperature",
      }),
    ];
  }

  return [];
}

function getOverallConfidence(weather: NormalizedWeatherSnapshot) {
  const availableFields = [
    weather.temperatureC,
    weather.precipitationMm,
    weather.snowfallCm,
    weather.visibilityKm,
    weather.windSpeedKph,
    weather.windGustKph,
    weather.weatherCode,
  ].filter((value) => typeof value === "number").length;
  const reasons: string[] = [];

  if (weather.source === "unavailable") {
    return {
      confidence: "LOW" as const,
      reasons: ["No forecast hour was matched within the supported time window."],
    };
  }

  if (weather.source === "nearest") {
    reasons.push("The nearest forecast hour was used instead of an exact hourly match.");
  } else {
    reasons.push("The route ETA has a close hourly forecast match.");
  }

  if (availableFields < 5) {
    reasons.push("Several normalized weather fields are missing at this checkpoint.");
  }

  return {
    confidence:
      weather.source === "exact" && availableFields >= 5
        ? ("HIGH" as const)
        : availableFields >= 3
          ? ("MEDIUM" as const)
          : ("LOW" as const),
    reasons,
  };
}

function isNight({
  etaUtc,
  pointTimeZone,
  weather,
}: {
  etaUtc: string;
  pointTimeZone: string;
  weather: NormalizedWeatherSnapshot;
}) {
  const hour = Number.parseInt(
    formatInTimeZone(new Date(etaUtc), pointTimeZone || "UTC", "H"),
    10,
  );
  const etaIsNight = Number.isFinite(hour) && (hour < 7 || hour >= 19);

  return weather.isDay === false || etaIsNight;
}

function categoryScore(findings: ScoredFinding[]) {
  const familyMaximums = new Map<ScoredFinding["family"], number>();

  for (const item of findings) {
    if (item.type === "data_uncertainty" || item.factorKey === "critical-combination") {
      continue;
    }

    familyMaximums.set(
      item.family,
      Math.max(familyMaximums.get(item.family) ?? 0, item.scoreContribution),
    );
  }

  const scores = Array.from(familyMaximums.values()).sort((left, right) => right - left);
  const [strongest = 0, ...remaining] = scores;

  return Math.round(
    strongest +
      remaining.reduce(
        (total, score, index) => total + score * (index === 0 ? 0.5 : 0.35),
        0,
      ),
  );
}

function buildInteractions(
  findings: ScoredFinding[],
  weather: NormalizedWeatherSnapshot,
): { findings: ScoredFinding[]; scoreFloor: number } {
  const interactions: ScoredFinding[] = [];
  const types = new Set(findings.map((item) => item.type));
  const snow = types.has("snow") || types.has("heavy_snow");
  const freezing = types.has("freezing_rain") || types.has("freezing_drizzle");
  const heavyRain = types.has("heavy_rain");
  const visibilityKm = weather.visibilityKm;
  const windMetric = Math.max(weather.windGustKph ?? 0, weather.windSpeedKph ?? 0);
  let scoreFloor = 0;

  if (freezing) {
    const heavy = weather.weatherCode === 57 || weather.weatherCode === 67;
    scoreFloor = Math.max(scoreFloor, heavy ? 75 : 60);
    interactions.push(
      finding({
        type: "compound_hazard",
        severity: heavy ? "EXTREME" : "MAJOR",
        scoreContribution: 0,
        title: "Freezing precipitation creates a high-loss-of-control risk",
        explanation:
          "A freezing-precipitation forecast is escalated even without other hazards because glaze can sharply reduce tire grip.",
        source: INFERENCE_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: inferredConfidence(weather),
        family: "context",
        factorKey: "critical-combination",
        scoreFloor: heavy ? 75 : 60,
      }),
    );
  }

  if (
    typeof visibilityKm === "number" &&
    visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.veryLow
  ) {
    scoreFloor = Math.max(
      scoreFloor,
      visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero ? 65 : 55,
    );
    interactions.push(
      finding({
        type: "compound_hazard",
        severity:
          visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero ? "MAJOR" : "MODERATE",
        scoreContribution: 0,
        title:
          visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero
            ? "Visibility is extremely limited for normal reaction distance"
            : "Visibility is low enough to sharply reduce reaction time",
        explanation:
          "The visibility floor prevents an isolated low-visibility forecast from being diluted by otherwise quiet conditions.",
        source: INFERENCE_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: inferredConfidence(weather),
        rawValue: Number(visibilityKm.toFixed(2)),
        units: "km",
        family: "context",
        factorKey: "critical-combination",
        scoreFloor:
          visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero ? 65 : 55,
      }),
    );
  }

  if (snow && windMetric >= HAZARD_THRESHOLDS.windKph.caution) {
    interactions.push(
      finding({
        type: "blowing_snow",
        severity: windMetric >= HAZARD_THRESHOLDS.windKph.strong ? "MAJOR" : "MODERATE",
        scoreContribution: 10,
        title: "Wind and snow can create blowing snow and sudden visibility drops",
        explanation:
          "Snow combined with forecast wind supports a blowing-snow proxy; drifting or a whiteout is not confirmed.",
        source: INFERENCE_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: inferredConfidence(weather),
        rawValue: Number(windMetric.toFixed(1)),
        units: "km/h",
        family: "context",
        factorKey: "wind-snow",
      }),
    );

    if (
      typeof visibilityKm === "number" &&
      visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.veryLow
    ) {
      const extreme =
        windMetric >= HAZARD_THRESHOLDS.windKph.strong &&
        visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.nearZero;
      scoreFloor = Math.max(scoreFloor, extreme ? 90 : 75);
      interactions.push(
        finding({
          type: "compound_hazard",
          severity: extreme ? "EXTREME" : "MAJOR",
          scoreContribution: 0,
          title: "Snow, wind, and poor visibility can create whiteout travel",
          explanation:
            "This combination can erase lane contrast and reaction distance; it is a forecast-based risk inference, not a confirmed whiteout report.",
          source: INFERENCE_SOURCE,
          observedOrForecast: "INFERRED",
          confidence: inferredConfidence(weather),
          family: "context",
          factorKey: "critical-combination",
          scoreFloor: extreme ? 90 : 75,
        }),
      );
    } else if (windMetric >= HAZARD_THRESHOLDS.windKph.damaging) {
      scoreFloor = Math.max(scoreFloor, 70);
      interactions.push(
        finding({
          type: "compound_hazard",
          severity: "MAJOR",
          scoreContribution: 0,
          title: "Snow with damaging gusts can cause drifting and sudden lane loss",
          explanation:
            "The combined snow-and-wind signal is more serious than either input alone; drifting is possible but not directly observed.",
          source: INFERENCE_SOURCE,
          observedOrForecast: "INFERRED",
          confidence: inferredConfidence(weather),
          family: "context",
          factorKey: "critical-combination",
          scoreFloor: 70,
        }),
      );
    }
  }

  if (heavyRain) {
    if (
      typeof visibilityKm === "number" &&
      visibilityKm <= HAZARD_THRESHOLDS.visibilityKm.low
    ) {
      scoreFloor = Math.max(scoreFloor, windMetric >= HAZARD_THRESHOLDS.windKph.strong ? 70 : 60);
      interactions.push(
        finding({
          type: "compound_hazard",
          severity: windMetric >= HAZARD_THRESHOLDS.windKph.strong ? "MAJOR" : "MODERATE",
          scoreContribution: 0,
          title: "Heavy rain and poor visibility compound stopping risk",
          explanation:
            "Rain intensity and limited visibility can reduce traction and reaction distance together; this does not confirm roadway flooding.",
          source: INFERENCE_SOURCE,
          observedOrForecast: "INFERRED",
          confidence: inferredConfidence(weather),
          family: "context",
          factorKey: "critical-combination",
          scoreFloor: windMetric >= HAZARD_THRESHOLDS.windKph.strong ? 70 : 60,
        }),
      );
    } else if (windMetric >= HAZARD_THRESHOLDS.windKph.strong) {
      scoreFloor = Math.max(scoreFloor, 55);
      interactions.push(
        finding({
          type: "compound_hazard",
          severity: "MODERATE",
          scoreContribution: 0,
          title: "Heavy rain and strong wind can destabilize travel",
          explanation:
            "Strong wind compounds heavy-rain traction and control demands; this does not indicate a flood or official weather warning.",
          source: INFERENCE_SOURCE,
          observedOrForecast: "INFERRED",
          confidence: inferredConfidence(weather),
          family: "context",
          factorKey: "critical-combination",
          scoreFloor: 55,
        }),
      );
    }
  }

  const substantialFamilies = new Set(
    findings
      .filter((item) => item.scoreContribution >= 10 && item.family !== "context")
      .map((item) => item.family),
  ).size;

  if (substantialFamilies >= 3) {
    scoreFloor = Math.max(scoreFloor, 50);
    interactions.push(
      finding({
        type: "compound_hazard",
        severity: "MODERATE",
        scoreContribution: 0,
        title: "Multiple driving hazards are compounding on this segment",
        explanation:
          "Independent hazard families are present together, so the model applies a conservative minimum rather than treating each signal in isolation.",
        source: INFERENCE_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: inferredConfidence(weather),
        family: "context",
        factorKey: "critical-combination",
        scoreFloor: 50,
      }),
    );
  }

  return { findings: interactions, scoreFloor };
}

export function getHazardRiskLabel(score: number): RiskLabel {
  if (score >= HAZARD_THRESHOLDS.riskScore.severe) {
    return "Severe";
  }

  if (score >= HAZARD_THRESHOLDS.riskScore.high) {
    return "High";
  }

  if (score >= HAZARD_THRESHOLDS.riskScore.moderate) {
    return "Moderate";
  }

  return "Low";
}

export function analyzeWeatherHazards({
  etaUtc,
  pointTimeZone,
  weather,
}: {
  etaUtc: string;
  pointTimeZone: string;
  weather: NormalizedWeatherSnapshot;
}): HazardEngineResult {
  const directFindings = [
    ...detectSnow(weather),
    ...detectIce(weather),
    ...detectVisibility(weather),
    ...detectWind(weather),
    ...detectRain(weather),
    ...detectStorm(weather),
    ...detectTemperature(weather),
  ];
  const interactionResult = buildInteractions(directFindings, weather);
  const findings = [...directFindings, ...interactionResult.findings];
  const preContextScore = categoryScore(findings);

  if (
    isNight({ etaUtc, pointTimeZone, weather }) &&
    directFindings.some((item) => item.scoreContribution >= 10)
  ) {
    findings.push(
      finding({
        type: "night_compounding",
        severity: "MINOR",
        scoreContribution: 8,
        title: "Night driving lowers visibility and reaction time",
        explanation:
          "Darkness compounds an existing hazard signal but never creates a high-risk result by itself.",
        source: INFERENCE_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: inferredConfidence(weather),
        family: "context",
        factorKey: "night",
      }),
    );
  }

  const confidence = getOverallConfidence(weather);

  if (confidence.confidence === "LOW") {
    findings.push(
      finding({
        type: "data_uncertainty",
        severity: "MINOR",
        scoreContribution: 0,
        title: "Forecast coverage is limited at this checkpoint",
        explanation:
          "Missing forecast fields reduce confidence. SnowRoute does not interpret missing data as evidence that conditions are safe.",
        source: weather.source === "unavailable" ? "No matched forecast hour" : FORECAST_SOURCE,
        observedOrForecast: "INFERRED",
        confidence: "LOW",
        family: "context",
        factorKey: "data-uncertainty",
      }),
    );
  }

  const baseScore = Math.max(preContextScore, categoryScore(findings));
  const riskScore = clamp(Math.max(baseScore, interactionResult.scoreFloor), 0, 100);
  const sortedFindings = [...findings].sort(
    (left, right) => right.scoreContribution - left.scoreContribution,
  );
  const scoredFactors = sortedFindings
    .filter(
      (item) => item.type !== "data_uncertainty" && item.factorKey !== "critical-combination",
    )
    .map<RiskFactor>((item) => ({
      key: item.factorKey,
      label: item.title,
      contribution: item.scoreContribution,
    }));
  const strongestFloorFinding = sortedFindings
    .filter((item) => item.factorKey === "critical-combination")
    .sort((left, right) => (right.scoreFloor ?? 0) - (left.scoreFloor ?? 0))[0];

  if (strongestFloorFinding && interactionResult.scoreFloor > baseScore) {
    scoredFactors.push({
      key: strongestFloorFinding.factorKey,
      label: strongestFloorFinding.title,
      contribution: interactionResult.scoreFloor - baseScore,
    });
  }

  const factors = scoredFactors
    .filter((item) => item.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution);

  return {
    hazards: sortedFindings.map(toPublicFinding),
    riskScore,
    riskLevel: getHazardRiskLabel(riskScore),
    confidence: confidence.confidence,
    confidenceReasons: confidence.reasons,
    factors,
    explanationFactors: factors.slice(0, 3).map((item) => item.label),
  };
}

export function buildAnalysisMetadata(analyzedAt = new Date()): AnalysisMetadata {
  return {
    analyzedAt: analyzedAt.toISOString(),
    analysisVersion: ANALYSIS_VERSION,
    riskModelVersion: RISK_MODEL_VERSION,
    weatherProvider: "Open-Meteo Forecast API",
    routeProvider: "openrouteservice Directions API",
    geocoderProvider: "openrouteservice Geocoding API",
  };
}
