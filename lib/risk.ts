import { formatInTimeZone } from "date-fns-tz";

import type {
  DataQuality,
  HazardWindow,
  Recommendation,
  RiskFactor,
  RiskGuidance,
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

function isSnowCode(code: number | null) {
  return code !== null && [71, 73, 75, 77, 85, 86].includes(code);
}

function isFreezingPrecipitationCode(code: number | null) {
  return code !== null && [56, 57, 66, 67].includes(code);
}

function getVisibilityContribution(visibilityKm: number) {
  if (visibilityKm <= 0.4) {
    return 40;
  }

  if (visibilityKm <= 0.8) {
    return 30;
  }

  if (visibilityKm <= 1.6) {
    return 20;
  }

  if (visibilityKm < 4.8) {
    return 10;
  }

  return 0;
}

function getWindContribution(windKph: number) {
  if (windKph >= 80) {
    return 28;
  }

  if (windKph >= 64) {
    return 18;
  }

  return windKph >= 48 ? 10 : 0;
}

function getHazardCodeContribution(code: number | null) {
  switch (code) {
    case 56:
      return {
        key: "freezing-precipitation",
        contribution: 24,
        label: "Freezing drizzle can glaze untreated pavement",
      };
    case 57:
      return {
        key: "freezing-precipitation",
        contribution: 30,
        label: "Dense freezing drizzle can rapidly create black ice",
      };
    case 66:
      return {
        key: "freezing-precipitation",
        contribution: 34,
        label: "Freezing rain can make braking and steering unreliable",
      };
    case 67:
      return {
        key: "freezing-precipitation",
        contribution: 42,
        label: "Heavy freezing rain is dangerous for ordinary travel",
      };
    case 75:
      return {
        key: "snowfall",
        contribution: 18,
        label: "Heavy snowfall forecast code",
      };
    case 86:
      return {
        key: "snowfall",
        contribution: 20,
        label: "Heavy snow showers can create sudden whiteouts",
      };
    case 95:
      return {
        key: "storm",
        contribution: 18,
        label: "Thunderstorm activity can produce sudden hazards",
      };
    case 96:
      return {
        key: "storm",
        contribution: 26,
        label: "Thunderstorm with hail can make travel erratic",
      };
    case 99:
      return {
        key: "storm",
        contribution: 32,
        label: "Severe thunderstorm with hail is unsafe for exposed travel",
      };
    case 48:
      return {
        key: "visibility",
        contribution: 12,
        label: "Dense fog risk",
      };
    case 45:
      return {
        key: "visibility",
        contribution: 8,
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
  const scoreFloors: RiskFactor[] = [];
  const temperatureC = weather.temperatureC;
  const precipitationMm = weather.precipitationMm ?? 0;
  const snowfallCm =
    weather.snowfallCm ??
    (isSnowCode(weather.weatherCode) ? precipitationMm * 0.8 : 0);
  const visibilityKm = weather.visibilityKm;
  const windMetric = Math.max(weather.windGustKph ?? 0, weather.windSpeedKph ?? 0);
  const snowSignal = snowfallCm > 0.15 || isSnowCode(weather.weatherCode);

  if (snowSignal) {
    const snowContribution = Math.round(
      Math.max(
        scaleToMax(snowfallCm, 0.15, 4, 45),
        isSnowCode(weather.weatherCode) ? 12 : 0,
      ),
    );
    factors.push({
      key: "snowfall",
      label:
        snowfallCm >= 4
          ? "Intense snowfall can overwhelm plowing and lane tracking"
          : snowfallCm >= 2
            ? "Heavy snowfall expected"
            : snowfallCm >= 0.75
            ? "Steady snowfall expected"
            : "Light snow along this segment",
      contribution: snowContribution,
    });
  }

  if (
    typeof temperatureC === "number" &&
    (precipitationMm > 0.1 || isFreezingPrecipitationCode(weather.weatherCode)) &&
    temperatureC >= -6 &&
    temperatureC <= 2
  ) {
    const temperatureProximity = 1 - Math.min(Math.abs(temperatureC - 0.5) / 6.5, 1);
    const precipitationIntensity = Math.min(Math.max(precipitationMm, 0.4) / 3, 1);
    const icingContribution = Math.round(
      15 + temperatureProximity * 10 + precipitationIntensity * 10,
    );

    factors.push({
      key: "icing",
      label: "Temperature near freezing increases ice risk",
      contribution: clamp(icingContribution, 0, 35),
    });
  }

  if (
    typeof temperatureC === "number" &&
    temperatureC < 0 &&
    (snowSignal || precipitationMm > 0.1)
  ) {
    factors.push({
      key: "temperature",
      label:
        temperatureC <= -10
          ? "Deep subfreezing temperatures can harden icy surfaces"
          : "Subfreezing temperatures can make surfaces slick",
      contribution: Math.round(scaleToMax(Math.abs(temperatureC), 0, 18, 8)),
    });
  }

  if (typeof visibilityKm === "number" && visibilityKm < 4.8) {
    factors.push({
      key: "visibility",
      label:
        visibilityKm <= 0.4
          ? "Near-whiteout or dense fog visibility"
          : visibilityKm < 1.5
            ? "Low visibility conditions"
            : "Reduced visibility expected",
      contribution: getVisibilityContribution(visibilityKm),
    });
  }

  if (windMetric >= 48) {
    factors.push({
      key: "wind",
      label:
        windMetric >= 80
          ? "Damaging gusts can push vehicles out of lane"
          : windMetric >= 64
          ? "Strong wind gusts could destabilize travel"
          : "Windy conditions may affect control",
      contribution: getWindContribution(windMetric),
    });

    if (snowSignal) {
      factors.push({
        key: "wind-snow",
        label: "Wind and snow can create blowing snow and sudden visibility drops",
        contribution: 10,
      });
    }
  }

  const hazardCode = getHazardCodeContribution(weather.weatherCode);

  if (hazardCode) {
    factors.push({
      key: hazardCode.key,
      label: hazardCode.label,
      contribution: hazardCode.contribution,
    });
  }

  if (isFreezingPrecipitationCode(weather.weatherCode)) {
    scoreFloors.push({
      key: "critical-combination",
      label: "Freezing precipitation creates a high-loss-of-control risk",
      contribution: weather.weatherCode === 57 || weather.weatherCode === 67 ? 75 : 60,
    });
  }

  if (typeof visibilityKm === "number" && visibilityKm <= 0.8) {
    scoreFloors.push({
      key: "critical-combination",
      label:
        visibilityKm <= 0.4
          ? "Visibility is near the level used for dense fog and blizzard warnings"
          : "Visibility is low enough to sharply reduce reaction time",
      contribution: visibilityKm <= 0.4 ? 65 : 55,
    });
  }

  if (snowSignal && typeof visibilityKm === "number" && visibilityKm <= 0.8 && windMetric >= 48) {
    scoreFloors.push({
      key: "critical-combination",
      label: "Snow, wind, and poor visibility can create whiteout travel",
      contribution: windMetric >= 64 && visibilityKm <= 0.4 ? 90 : 75,
    });
  }

  if (snowSignal && windMetric >= 80) {
    scoreFloors.push({
      key: "critical-combination",
      label: "Snow with damaging gusts can cause drifting and sudden lane loss",
      contribution: 70,
    });
  }

  if (weather.weatherCode === 99) {
    scoreFloors.push({
      key: "critical-combination",
      label: "Severe thunderstorm and hail signal is unsafe for exposed travel",
      contribution: 70,
    });
  }

  const localHour = Number.parseInt(
    formatInTimeZone(new Date(etaUtc), pointTimeZone || "UTC", "H"),
    10,
  );

  const winterPrecipitation =
    snowSignal ||
    precipitationMm > 0.1 ||
    isFreezingPrecipitationCode(weather.weatherCode);
  const preNightContribution = factors.reduce((total, factor) => total + factor.contribution, 0);

  if (
    Number.isFinite(localHour) &&
    (localHour < 7 || localHour >= 19) &&
    (winterPrecipitation || preNightContribution >= 25)
  ) {
    factors.push({
      key: "night",
      label: "Night driving lowers visibility and reaction time",
      contribution: winterPrecipitation ? 8 : 12,
    });
  }

  let sortedFactors = factors
    .filter((factor) => factor.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution);
  const baseScore = Math.round(
    sortedFactors.reduce((total, factor) => total + factor.contribution, 0),
  );
  const substantialHazardCount = sortedFactors.filter(
    (factor) => factor.key !== "night" && factor.contribution >= 10,
  ).length;

  if (substantialHazardCount >= 3) {
    scoreFloors.push({
      key: "critical-combination",
      label: "Multiple winter hazards are compounding on this segment",
      contribution: 50,
    });
  }

  const strongestFloor = scoreFloors.sort(
    (left, right) => right.contribution - left.contribution,
  )[0];

  if (strongestFloor && strongestFloor.contribution > baseScore) {
    sortedFactors = [
      ...sortedFactors,
      {
        ...strongestFloor,
        contribution: strongestFloor.contribution - baseScore,
      },
    ].sort((left, right) => right.contribution - left.contribution);
  }

  const score = clamp(Math.max(baseScore, strongestFloor?.contribution ?? 0), 0, 100);
  const label = getRiskLabel(score);

  return {
    score,
    label,
    factors: sortedFactors,
    explanationFactors: sortedFactors.slice(0, 3).map((factor) => factor.label),
    guidance: buildRiskGuidance(label, score, sortedFactors),
  };
}

function selectDominantFactorDetails(samples: RouteSample[]) {
  const tallies = new Map<string, RiskFactor>();

  for (const sample of samples) {
    for (const factor of sample.factors) {
      const key = `${factor.key}:${factor.label}`;
      const existing = tallies.get(key);
      tallies.set(key, {
        key: factor.key,
        label: factor.label,
        contribution: (existing?.contribution ?? 0) + factor.contribution,
      });
    }
  }

  return Array.from(tallies.values()).sort(
    (left, right) => right.contribution - left.contribution,
  );
}

function selectDominantFactors(samples: RouteSample[]) {
  return selectDominantFactorDetails(samples)
    .slice(0, 3)
    .map((factor) => factor.label);
}

function buildRiskGuidance(
  label: RiskLabel,
  score: number,
  factors: RiskFactor[],
): RiskGuidance {
  const dominantFactors = factors.slice(0, 3);
  const dominantText =
    dominantFactors.map((factor) => factor.label).join("; ") ||
    "No major hazard signal detected";
  const keys = new Set(dominantFactors.map((factor) => factor.key));
  const actionDetails: string[] = [];

  if (keys.has("freezing-precipitation") || keys.has("icing")) {
    actionDetails.push(
      "Treat bridges, ramps, shaded pavement, and untreated roads as potentially icy.",
    );
  }

  if (keys.has("visibility")) {
    actionDetails.push(
      "Increase following distance dramatically and be ready for traffic to slow without warning.",
    );
  }

  if (keys.has("snowfall")) {
    actionDetails.push(
      "Expect lane markings, shoulders, and stopping distance to deteriorate before plows catch up.",
    );
  }

  if (keys.has("wind")) {
    actionDetails.push(
      "Avoid exposed highways if driving a light, tall, or trailer-towing vehicle.",
    );
  }

  if (keys.has("night")) {
    actionDetails.push("Build in extra margin because hazards will be harder to see at night.");
  }

  const specificPlan =
    actionDetails.length > 0
      ? ` ${actionDetails.join(" ")}`
      : " Keep checking conditions and avoid rushing the schedule.";

  if (label === "Severe") {
    return {
      headline: `Severe risk (${score}/100): ${dominantText}`,
      impact:
        "This is in the range where an ordinary passenger-vehicle trip can become unsafe quickly, with a real chance of losing traction, running out of visibility, or being unable to stop normally.",
      gamePlan: `Avoid travel unless it is essential. Delay until the flagged window passes, choose a lower-exposure route, or stop before the hazard area.${specificPlan}`,
    };
  }

  if (label === "High") {
    return {
      headline: `High risk (${score}/100): ${dominantText}`,
      impact:
        "Conditions may exceed what normal cautious driving can comfortably absorb, especially if traffic speed stays high or the road has not been treated.",
      gamePlan: `Delay if your schedule is flexible. If you must go, slow down early, leave large gaps, avoid cruise control, and plan a safe bailout stop before the worst segment.${specificPlan}`,
    };
  }

  if (label === "Moderate") {
    return {
      headline: `Moderate risk (${score}/100): ${dominantText}`,
      impact:
        "The route is not automatically unsafe, but winter factors are strong enough that small mistakes, untreated pavement, or sudden traffic changes matter more.",
      gamePlan: `Go only with winter-ready tires, extra time, and a willingness to turn around or pause if conditions worsen.${specificPlan}`,
    };
  }

  return {
    headline: `Low risk (${score}/100): no major winter hazard signal`,
    impact:
      "Forecast signals are generally manageable, though local road treatment, crashes, and fast-changing weather can still matter.",
    gamePlan:
      "Keep a normal winter margin, monitor conditions near departure, and reassess if the forecast changes.",
  };
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
    const label = maxScore >= 75 ? "Severe" : "High";
    const dominantFactors = selectDominantFactors(windowSamples);
    const approximateLocationLabel = `near route km ${windowSamples[0].distanceKm.toFixed(0)}`;
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
      label,
      dominantFactors,
      guidance: buildRiskGuidance(label, maxScore, selectDominantFactorDetails(windowSamples)),
      sampleIds: windowSamples.map((sample) => sample.id),
      startSampleIndex: windowStart,
      endSampleIndex: windowEnd,
      approximateLocationLabel,
      summary: `${label} winter risk ${approximateLocationLabel} from ${dominantFactors.slice(0, 2).join(" and ").toLowerCase() || "stacked winter hazards"}.`,
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
  const overallLabel = getRiskLabel(overallScore);
  const worstSegment = routeSegments.reduce<RouteSegment | null>((currentWorst, segment) => {
    if (!currentWorst || segment.score > currentWorst.score) {
      return segment;
    }

    return currentWorst;
  }, null);

  return {
    overallScore,
    overallLabel,
    recommendation: selectRecommendation({
      overallScore,
      hazardWindows,
      totalSamples: samples.length,
    }),
    worstSegmentId: worstSegment?.id ?? null,
    averageScore,
    maxScore,
    dataQuality: buildDataQuality(samples),
    guidance: buildRiskGuidance(overallLabel, overallScore, selectDominantFactorDetails(samples)),
  };
}
