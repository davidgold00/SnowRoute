import { formatInTimeZone } from "date-fns-tz";

import type {
  DataQuality,
  HazardWindow,
  Recommendation,
  RiskFactor,
  RiskLabel,
  RouteSample,
  RouteSegment,
  RouteSummary,
} from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scaleToMax(value: number, min: number, max: number, cap: number) {
  if (value <= min) {
    return 0;
  }

  if (value >= max) {
    return cap;
  }

  return ((value - min) / (max - min)) * cap;
}

function scaleInverse(value: number, min: number, max: number, cap: number) {
  if (value >= max) {
    return 0;
  }

  if (value <= min) {
    return cap;
  }

  return ((max - value) / (max - min)) * cap;
}

function isSnowCode(code: number | null) {
  return code !== null && [71, 73, 75, 77, 85, 86].includes(code);
}

function getHazardCodeContribution(code: number | null) {
  switch (code) {
    case 56:
    case 57:
    case 66:
    case 67:
      return {
        contribution: 10,
        label: "Freezing precipitation signal",
      };
    case 75:
    case 86:
      return {
        contribution: 9,
        label: "Severe snow forecast code",
      };
    case 95:
    case 96:
    case 99:
      return {
        contribution: 10,
        label: "Convective storm activity",
      };
    case 48:
      return {
        contribution: 7,
        label: "Dense fog risk",
      };
    case 45:
      return {
        contribution: 6,
        label: "Fog signal in forecast",
      };
    default:
      return null;
  }
}

export function getRiskLabel(score: number): RiskLabel {
  if (score >= 75) {
    return "Severe";
  }

  if (score >= 50) {
    return "High";
  }

  if (score >= 25) {
    return "Moderate";
  }

  return "Low";
}

export function scoreRouteSampleRisk({
  etaUtc,
  pointTimeZone,
  weather,
}: Pick<RouteSample, "etaUtc" | "pointTimeZone" | "weather">) {
  const factors: RiskFactor[] = [];
  const temperatureC = weather.temperatureC;
  const precipitationMm = weather.precipitationMm ?? 0;
  const snowfallCm =
    weather.snowfallCm ??
    (isSnowCode(weather.weatherCode) ? precipitationMm * 0.8 : 0);
  const visibilityKm = weather.visibilityKm;
  const windMetric = Math.max(weather.windGustKph ?? 0, weather.windSpeedKph ?? 0);

  if (snowfallCm > 0.15 || isSnowCode(weather.weatherCode)) {
    const snowContribution = Math.round(
      Math.max(scaleToMax(snowfallCm, 0.15, 3.5, 30), isSnowCode(weather.weatherCode) ? 8 : 0),
    );
    factors.push({
      key: "snowfall",
      label:
        snowfallCm >= 2
          ? "Heavy snowfall expected"
          : snowfallCm >= 0.75
            ? "Steady snowfall expected"
            : "Light snow along this segment",
      contribution: snowContribution,
    });
  }

  if (
    typeof temperatureC === "number" &&
    precipitationMm > 0.1 &&
    temperatureC >= -3 &&
    temperatureC <= 1
  ) {
    const temperatureProximity = 1 - Math.min(Math.abs(temperatureC + 0.5) / 3.5, 1);
    const precipitationIntensity = Math.min(precipitationMm / 3, 1);
    const icingContribution = Math.round(
      8 + temperatureProximity * 7 + precipitationIntensity * 5,
    );

    factors.push({
      key: "icing",
      label: "Temperature near freezing increases ice risk",
      contribution: clamp(icingContribution, 0, 20),
    });
  }

  if (typeof temperatureC === "number" && temperatureC < 0) {
    factors.push({
      key: "temperature",
      label:
        temperatureC <= -10
          ? "Deep subfreezing temperatures can harden icy surfaces"
          : "Subfreezing temperatures can make surfaces slick",
      contribution: Math.round(scaleToMax(Math.abs(temperatureC), 0, 15, 10)),
    });
  }

  if (typeof visibilityKm === "number" && visibilityKm < 8) {
    factors.push({
      key: "visibility",
      label:
        visibilityKm < 1.5 ? "Low visibility conditions" : "Reduced visibility expected",
      contribution: Math.round(scaleInverse(visibilityKm, 0.4, 8, 15)),
    });
  }

  if (windMetric >= 25) {
    factors.push({
      key: "wind",
      label:
        windMetric >= 55
          ? "Strong wind gusts could destabilize travel"
          : "Windy conditions may affect control",
      contribution: Math.round(scaleToMax(windMetric, 25, 80, 15)),
    });
  }

  const hazardCode = getHazardCodeContribution(weather.weatherCode);

  if (hazardCode) {
    factors.push({
      key: "weather-code",
      label: hazardCode.label,
      contribution: hazardCode.contribution,
    });
  }

  const localHour = Number.parseInt(
    formatInTimeZone(new Date(etaUtc), pointTimeZone || "UTC", "H"),
    10,
  );

  if (Number.isFinite(localHour) && (localHour < 7 || localHour >= 19)) {
    factors.push({
      key: "night",
      label: "Night driving lowers visibility and reaction time",
      contribution: 5,
    });
  }

  const sortedFactors = factors
    .filter((factor) => factor.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution);
  const score = clamp(
    Math.round(
      sortedFactors.reduce((total, factor) => total + factor.contribution, 0),
    ),
    0,
    100,
  );

  return {
    score,
    label: getRiskLabel(score),
    factors: sortedFactors,
    explanationFactors: sortedFactors.slice(0, 3).map((factor) => factor.label),
  };
}

function selectDominantFactors(samples: RouteSample[]) {
  const tallies = new Map<string, number>();

  for (const sample of samples) {
    for (const factor of sample.factors) {
      tallies.set(factor.label, (tallies.get(factor.label) ?? 0) + factor.contribution);
    }
  }

  return Array.from(tallies.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label);
}

export function buildHazardWindows(
  samples: RouteSample[],
  displayTimeZone: string,
): HazardWindow[] {
  const hazardousIndexes = samples
    .map((sample, index) => (sample.score >= 50 ? index : -1))
    .filter((index) => index >= 0);

  if (hazardousIndexes.length === 0) {
    return [];
  }

  const windows: HazardWindow[] = [];
  let startIndex = hazardousIndexes[0];
  let lastHazardIndex = hazardousIndexes[0];

  const finalizeWindow = (windowStart: number, windowEnd: number) => {
    const windowSamples = samples.slice(windowStart, windowEnd + 1);
    const maxScore = Math.max(...windowSamples.map((sample) => sample.score));
    windows.push({
      id: `hazard-${windows.length + 1}`,
      startEtaUtc: windowSamples[0].etaUtc,
      endEtaUtc: windowSamples.at(-1)?.etaUtc ?? windowSamples[0].etaUtc,
      startEtaDisplay: formatInTimeZone(
        new Date(windowSamples[0].etaUtc),
        displayTimeZone,
        "MMM d, HH:mm zzz",
      ),
      endEtaDisplay: formatInTimeZone(
        new Date(windowSamples.at(-1)?.etaUtc ?? windowSamples[0].etaUtc),
        displayTimeZone,
        "MMM d, HH:mm zzz",
      ),
      maxScore,
      label: maxScore >= 75 ? "Severe" : "High",
      dominantFactors: selectDominantFactors(windowSamples),
      sampleIds: windowSamples.map((sample) => sample.id),
    });
  };

  for (let index = 1; index < hazardousIndexes.length; index += 1) {
    const currentIndex = hazardousIndexes[index];

    if (currentIndex - lastHazardIndex <= 2) {
      lastHazardIndex = currentIndex;
      continue;
    }

    finalizeWindow(startIndex, lastHazardIndex);
    startIndex = currentIndex;
    lastHazardIndex = currentIndex;
  }

  finalizeWindow(startIndex, lastHazardIndex);

  return windows;
}

function buildDataQuality(samples: RouteSample[]): DataQuality {
  return samples.reduce<DataQuality>(
    (quality, sample) => {
      if (sample.weather.snowfallCm === null) {
        quality.missingSnowfallSamples += 1;
      }

      if (sample.weather.visibilityKm === null) {
        quality.missingVisibilitySamples += 1;
      }

      if (sample.weather.source === "nearest") {
        quality.fallbackMatches += 1;
      }

      if (sample.weather.source === "unavailable") {
        quality.unmatchedSamples += 1;
      }

      if (
        sample.weather.snowfallCm === null ||
        sample.weather.visibilityKm === null ||
        sample.weather.source === "unavailable"
      ) {
        quality.incompleteWeatherSamples += 1;
      }

      return quality;
    },
    {
      missingSnowfallSamples: 0,
      missingVisibilitySamples: 0,
      fallbackMatches: 0,
      unmatchedSamples: 0,
      incompleteWeatherSamples: 0,
    },
  );
}

function selectRecommendation({
  overallScore,
  hazardWindows,
  totalSamples,
}: {
  overallScore: number;
  hazardWindows: HazardWindow[];
  totalSamples: number;
}): Recommendation {
  const severeWindows = hazardWindows.filter((window) => window.label === "Severe");
  const severeCoverageRatio =
    severeWindows.reduce((total, window) => total + window.sampleIds.length, 0) /
    Math.max(totalSamples, 1);

  if (overallScore >= 75 || severeCoverageRatio >= 0.2) {
    return "Avoid travel";
  }

  if (overallScore >= 50 || severeWindows.length > 0) {
    return "Delay recommended";
  }

  if (overallScore >= 25 || hazardWindows.length > 0) {
    return "Use caution";
  }

  return "Safe";
}

export function buildTripSummary(
  samples: RouteSample[],
  hazardWindows: HazardWindow[],
  routeSegments: RouteSegment[],
): RouteSummary {
  const averageScore =
    samples.length === 0
      ? 0
      : Math.round(
          samples.reduce((total, sample) => total + sample.score, 0) / samples.length,
        );
  const maxScore = Math.max(0, ...samples.map((sample) => sample.score));
  const overallScore = Math.round(averageScore * 0.6 + maxScore * 0.4);
  const worstSegment = routeSegments.reduce<RouteSegment | null>((currentWorst, segment) => {
    if (!currentWorst || segment.score > currentWorst.score) {
      return segment;
    }

    return currentWorst;
  }, null);

  return {
    overallScore,
    overallLabel: getRiskLabel(overallScore),
    recommendation: selectRecommendation({
      overallScore,
      hazardWindows,
      totalSamples: samples.length,
    }),
    worstSegmentId: worstSegment?.id ?? null,
    averageScore,
    maxScore,
    dataQuality: buildDataQuality(samples),
  };
}
