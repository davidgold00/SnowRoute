import type { HazardWindow, RouteAnalysisResponse, RouteSample } from "@/lib/types";

export type HoldLikelihood = "Monitor" | "Elevated" | "High";

export type WeatherHoldStrategy = {
  id: string;
  likelihood: number;
  likelihoodLabel: HoldLikelihood;
  holdPoint: RouteSample;
  hazardStart: RouteSample;
  worstSample: RouteSample;
  window: HazardWindow;
  evidence: string[];
  action: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getLikelihoodLabel(likelihood: number): HoldLikelihood {
  if (likelihood >= 75) {
    return "High";
  }

  if (likelihood >= 55) {
    return "Elevated";
  }

  return "Monitor";
}

function findSamplesForWindow(samples: RouteSample[], window: HazardWindow) {
  const sampleIdSet = new Set(window.sampleIds);

  return samples.filter((sample) => sampleIdSet.has(sample.id));
}

function buildEvidence(sample: RouteSample) {
  const evidence: string[] = [];
  const { weather } = sample;

  if (weather.snowfallCm !== null && weather.snowfallCm > 0.1) {
    evidence.push(`${weather.snowfallCm.toFixed(1)} cm snowfall forecast near the peak`);
  }

  if (weather.precipitationMm !== null && weather.precipitationMm > 0.1) {
    evidence.push(`${weather.precipitationMm.toFixed(1)} mm hourly precipitation forecast`);
  }

  if (weather.visibilityKm !== null && weather.visibilityKm < 5) {
    evidence.push(`${weather.visibilityKm.toFixed(1)} km forecast visibility`);
  }

  if (weather.windGustKph !== null && weather.windGustKph >= 35) {
    evidence.push(`${Math.round(weather.windGustKph)} kph forecast gusts`);
  }

  if (
    weather.temperatureC !== null &&
    weather.temperatureC >= -3 &&
    weather.temperatureC <= 1 &&
    (weather.precipitationMm ?? 0) > 0.1
  ) {
    evidence.push(`${weather.temperatureC.toFixed(1)}°C with precipitation (ice-risk range)`);
  }

  return evidence.length > 0
    ? evidence.slice(0, 3)
    : sample.explanationFactors.slice(0, 3);
}

function estimateHoldLikelihood(sample: RouteSample, window: HazardWindow) {
  const { weather } = sample;
  let likelihood = window.maxScore * 0.7;

  if (weather.visibilityKm !== null) {
    if (weather.visibilityKm <= 0.8) {
      likelihood += 12;
    } else if (weather.visibilityKm <= 1.6) {
      likelihood += 8;
    }
  }

  if (weather.windGustKph !== null && weather.windGustKph >= 45) {
    likelihood += 8;
  }

  if (weather.snowfallCm !== null && weather.snowfallCm > 0.5) {
    likelihood += 6;
  }

  if (
    weather.temperatureC !== null &&
    weather.temperatureC >= -3 &&
    weather.temperatureC <= 1 &&
    (weather.precipitationMm ?? 0) > 0.1
  ) {
    likelihood += 10;
  }

  if (window.label === "Severe") {
    likelihood += 8;
  }

  return Math.round(clamp(likelihood, 30, 95));
}

function buildAction(likelihood: number) {
  if (likelihood >= 75) {
    return "Plan a weather hold before this checkpoint. Confirm a staffed service area, rest area, or other legal off-road location before entering the flagged stretch; do not continue into rapidly worsening visibility to search for one.";
  }

  if (likelihood >= 55) {
    return "Identify a legal off-road stopping option before this checkpoint and reassess conditions there. If observed visibility or traction is deteriorating faster than forecast, wait for improvement rather than pressing into the flagged stretch.";
  }

  return "Keep this checkpoint as a decision point. Recheck the forecast, road advisories, and visibility before the flagged stretch, and be prepared to use a legal off-road stop if conditions worsen.";
}

/**
 * Turns high-risk forecast windows into conservative, route-relative decision points.
 * The percentage is an operational planning indicator derived from the app's risk
 * model and forecast inputs; it is not a calibrated crash or road-closure probability.
 */
export function buildWeatherHoldStrategies(
  analysis: RouteAnalysisResponse,
): WeatherHoldStrategy[] {
  return analysis.hazardWindows.flatMap((window) => {
    const windowSamples = findSamplesForWindow(analysis.samples, window);
    const hazardStart = windowSamples[0];

    if (!hazardStart) {
      return [];
    }

    const hazardStartIndex = analysis.samples.findIndex(
      (sample) => sample.id === hazardStart.id,
    );
    const holdPoint =
      hazardStartIndex > 0 ? analysis.samples[hazardStartIndex - 1] : hazardStart;
    const worstSample = windowSamples.reduce(
      (currentWorst, sample) => (sample.score > currentWorst.score ? sample : currentWorst),
      hazardStart,
    );
    const likelihood = estimateHoldLikelihood(worstSample, window);

    return [
      {
        id: `weather-hold-${window.id}`,
        likelihood,
        likelihoodLabel: getLikelihoodLabel(likelihood),
        holdPoint,
        hazardStart,
        worstSample,
        window,
        evidence: buildEvidence(worstSample),
        action: buildAction(likelihood),
      },
    ];
  });
}
