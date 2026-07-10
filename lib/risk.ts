import { formatInTimeZone } from "date-fns-tz";

import { analyzeWeatherHazards, getHazardRiskLabel } from "@/lib/hazard-engine";
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

export function getRiskLabel(score: number): RiskLabel {
  return getHazardRiskLabel(score);
}

export function scoreRouteSampleRisk({
  etaUtc,
  pointTimeZone,
  weather,
}: Pick<RouteSample, "etaUtc" | "pointTimeZone" | "weather">) {
  const result = analyzeWeatherHazards({ etaUtc, pointTimeZone, weather });

  return {
    score: result.riskScore,
    label: result.riskLevel,
    factors: result.factors,
    explanationFactors: result.explanationFactors,
    hazards: result.hazards,
    hazardConfidence: result.confidence,
    hazardConfidenceReasons: result.confidenceReasons,
    guidance: buildRiskGuidance(result.riskLevel, result.riskScore, result.factors),
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
        "Conditions may exceed what normal cautious driving can comfortably absorb; multiple road-weather hazards can be especially difficult at road speed.",
      gamePlan: `Delay if your schedule is flexible. If you must go, slow down early, leave large gaps, avoid cruise control, and identify a legal off-road stopping option before the worst segment.${specificPlan}`,
    };
  }

  if (label === "Moderate") {
    return {
      headline: `Moderate risk (${score}/100): ${dominantText}`,
      impact:
        "The forecast calls for added caution: small mistakes, limited traction or visibility, and sudden traffic changes may matter more.",
      gamePlan: `Leave extra time and be willing to turn around or pause if conditions worsen.${specificPlan}`,
    };
  }

  return {
    headline: `Low risk (${score}/100): no major road-weather hazard signal`,
    impact:
      "Forecast signals are generally manageable, though local road treatment, crashes, and fast-changing weather can still matter.",
    gamePlan:
      "Keep ordinary driving margins, monitor conditions near departure, and reassess if the forecast changes.",
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
      summary: `${label} driving risk ${approximateLocationLabel} from ${dominantFactors.slice(0, 2).join(" and ").toLowerCase() || "compounding weather hazards"}.`,
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

  return "Lower risk";
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
