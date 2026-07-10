import type {
  DepartureOptimization,
  DepartureTimeOption,
  ForecastConfidence,
  HazardWindow,
  HoldRecommendation,
  RouteSample,
  RouteSummary,
  SaferDepartureWindow,
  TripDecision,
  TripDecisionLevel,
} from "@/lib/types";

const SAFETY_DISCLAIMER =
  "SnowRoute is a forecast-based planning tool, not an official road-safety authority. Check transportation-agency conditions, closures, local advisories, and emergency guidance before travel.";

function riskRank(label: RouteSample["label"]) {
  return label === "Severe" ? 3 : label === "High" ? 2 : label === "Moderate" ? 1 : 0;
}

function isHighOrSevere(sample: RouteSample) {
  return sample.label === "High" || sample.label === "Severe";
}

function hasConsecutiveRisk(samples: RouteSample[], minimumRunLength: number, severeOnly = false) {
  let runLength = 0;

  for (const sample of samples) {
    const matches = severeOnly ? sample.label === "Severe" : isHighOrSevere(sample);
    runLength = matches ? runLength + 1 : 0;

    if (runLength >= minimumRunLength) {
      return true;
    }
  }

  return false;
}

function getCheckpointLabel(sample: RouteSample) {
  return `route checkpoint near ${sample.distanceKm.toFixed(0)} km`;
}

function getConfidence(summary: RouteSummary, samples: RouteSample[]) {
  const quality = summary.dataQuality;
  const sampleCount = samples.length;
  const matchedRatio =
    sampleCount === 0 ? 0 : (sampleCount - quality.unmatchedSamples) / sampleCount;
  const incompleteRatio = sampleCount === 0 ? 1 : quality.incompleteWeatherSamples / sampleCount;
  const reasons: string[] = [];
  let confidence: ForecastConfidence;

  if (matchedRatio >= 0.9 && incompleteRatio <= 0.25) {
    confidence = "High";
    reasons.push("Hourly forecast matching was available for most route checkpoints.");
  } else if (matchedRatio >= 0.55) {
    confidence = "Medium";
    reasons.push("Some checkpoint weather fields or hourly matches were limited.");
  } else {
    confidence = "Low";
    reasons.push("Forecast coverage is limited for important parts of this route.");
  }

  if (quality.fallbackMatches > 0) {
    reasons.push(`${quality.fallbackMatches} checkpoint(s) used the nearest available forecast hour.`);
  }

  if (quality.unmatchedSamples > 0) {
    reasons.push(`${quality.unmatchedSamples} checkpoint(s) had no hourly forecast match within two hours.`);
  }

  const materialSamples = samples.filter(
    (sample) => sample.score >= Math.max(25, summary.maxScore - 10),
  );
  const materialHazards = materialSamples.flatMap((sample) => sample.hazards ?? []).filter(
    (hazard) =>
      hazard.scoreContribution >= 10 ||
      hazard.severity === "MAJOR" ||
      hazard.severity === "EXTREME" ||
      hazard.type === "compound_hazard",
  );
  const hasLowConfidenceDriver =
    materialSamples.some((sample) => sample.hazardConfidence === "LOW") ||
    materialHazards.some((hazard) => hazard.confidence === "LOW");
  const hasMediumConfidenceDriver =
    materialSamples.some((sample) => sample.hazardConfidence === "MEDIUM") ||
    materialHazards.some((hazard) => hazard.confidence === "MEDIUM");
  const hasInferenceDriver = materialHazards.some(
    (hazard) => hazard.observedOrForecast === "INFERRED",
  );

  if (hasLowConfidenceDriver) {
    confidence = "Low";
    reasons.push("At least one decision-driving hazard has low forecast or inference confidence.");
  } else if (hasMediumConfidenceDriver && confidence === "High") {
    confidence = "Medium";
    reasons.push("At least one decision-driving hazard has medium forecast or inference confidence.");
  }

  if (hasInferenceDriver) {
    reasons.push(
      "Part of the recommendation is inferred from forecast fields rather than a direct road observation.",
    );
  }

  return { confidence, reasons };
}

function getDataQualityNotes(summary: RouteSummary) {
  const quality = summary.dataQuality;
  const notes = [
    "Road-surface observations, live closures, plow status, and chain restrictions are not included.",
  ];

  if (quality.unmatchedSamples > 0) {
    notes.unshift(`${quality.unmatchedSamples} sampled checkpoint(s) did not have an hourly forecast match.`);
  }

  if (quality.missingVisibilitySamples > 0) {
    notes.push(`${quality.missingVisibilitySamples} checkpoint(s) were missing visibility data.`);
  }

  if (quality.missingSnowfallSamples > 0) {
    notes.push(`${quality.missingSnowfallSamples} checkpoint(s) were missing snowfall data.`);
  }

  return notes;
}

function getMainHazards(samples: RouteSample[]) {
  const factors = new Map<string, { label: string; contribution: number }>();

  for (const sample of samples) {
    for (const factor of sample.factors) {
      const existing = factors.get(factor.key);
      factors.set(factor.key, {
        label: factor.label,
        contribution: (existing?.contribution ?? 0) + factor.contribution,
      });
    }
  }

  return Array.from(factors.values())
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 4)
    .map((factor) => factor.label);
}

function optionDecision(option: DepartureTimeOption): TripDecisionLevel {
  if (option.label === "Severe") {
    return "AVOID";
  }

  if (option.label === "High") {
    return "DELAY";
  }

  if (option.label === "Moderate") {
    return "CAUTION";
  }

  return "GO";
}

function isMateriallySafer(
  selectedOption: DepartureTimeOption | undefined,
  candidate: DepartureTimeOption | undefined,
) {
  if (!selectedOption || !candidate || selectedOption.id === candidate.id) {
    return false;
  }

  if (selectedOption.label === "Low") {
    return false;
  }

  return (
    riskRank(candidate.label) < riskRank(selectedOption.label) ||
    candidate.overallScore <= selectedOption.overallScore - 10 ||
    candidate.maxScore <= selectedOption.maxScore - 15 ||
    candidate.hazardWindowCount < selectedOption.hazardWindowCount
  );
}

function buildSaferDepartureWindows(optimization: DepartureOptimization) {
  const selectedOption = optimization.options.find((option) => option.isSelectedHour);
  const alternatives = optimization.options
    .filter((option) => isMateriallySafer(selectedOption, option))
    .sort((left, right) => left.overallScore - right.overallScore)
    .slice(0, 3);

  const windows: SaferDepartureWindow[] = alternatives.map((option) => ({
    id: option.id,
    departureTimeUtc: option.departureTimeUtc,
    departureTime: option.departureTimeDisplay,
    decision: optionDecision(option),
    overallRisk: option.label,
    worstSegmentRisk:
      option.maxScore >= 75 ? "Severe" : option.maxScore >= 50 ? "High" : option.maxScore >= 25 ? "Moderate" : "Low",
    summary:
      option.guidance.headline ||
      `This hour has a lower forecast-based route risk than the selected departure.`,
    improvementComparedToSelected: selectedOption
      ? `Overall risk ${selectedOption.overallScore}/100 → ${option.overallScore}/100; worst checkpoint ${selectedOption.maxScore}/100 → ${option.maxScore}/100.`
      : null,
  }));

  return { selectedOption, windows };
}

function buildHoldRecommendation(samples: RouteSample[], windows: HazardWindow[]) {
  const firstDangerWindow = windows[0];

  if (!firstDangerWindow || firstDangerWindow.startSampleIndex < 2) {
    return null;
  }

  const holdIndex = firstDangerWindow.startSampleIndex - 1;
  const holdPoint = samples[holdIndex];
  const dangerStart = samples[firstDangerWindow.startSampleIndex];

  if (!holdPoint || !dangerStart || isHighOrSevere(holdPoint)) {
    return null;
  }

  const recommendation: HoldRecommendation = {
    shouldHold: true,
    holdBeforeLocationLabel: getCheckpointLabel(holdPoint),
    holdBeforeSegmentIndex: holdIndex,
    estimatedArrivalTime: holdPoint.etaDisplay,
    dangerBeginsAround: dangerStart.etaDisplay,
    reason: `The route is more manageable through ${getCheckpointLabel(holdPoint)}, but ${firstDangerWindow.label.toLowerCase()} driving risk begins ahead around ${dangerStart.etaDisplay}. ${firstDangerWindow.dominantFactors.slice(0, 2).join(" and ")} are the main forecast signals.`,
    resumeWindow: firstDangerWindow.endEtaDisplay,
    riskIfContinuing: firstDangerWindow.label,
  };

  return recommendation;
}

function buildDecisionCopy({
  decision,
  worstSample,
  saferDeparture,
  holdRecommendation,
  mainHazards,
}: {
  decision: TripDecisionLevel;
  worstSample: RouteSample;
  saferDeparture: SaferDepartureWindow | undefined;
  holdRecommendation: HoldRecommendation | null;
  mainHazards: string[];
}) {
  const hazardSummary = mainHazards.slice(0, 2).join(" and ").toLowerCase();

  switch (decision) {
    case "GO":
      return {
        label: "Proceed with ordinary caution",
        summary:
          "Forecast-based driving risk appears lower for this departure. Conditions are not guaranteed safe; continue to check official road and weather information before leaving.",
      };
    case "CAUTION":
      return {
        label: "Go with caution",
        summary: `Expect weather-related trouble spots near ${getCheckpointLabel(worstSample)} around ${worstSample.etaDisplay}. ${hazardSummary || "Forecast hazards"} may affect travel.`,
      };
    case "DELAY":
      return {
        label: "Delay recommended",
        summary: saferDeparture
          ? `A lower-risk departure around ${saferDeparture.departureTime} appears available. Your selected timing reaches ${getCheckpointLabel(worstSample)} during ${hazardSummary || "the highest forecast driving risk"}.`
          : `This departure reaches ${getCheckpointLabel(worstSample)} during high forecast driving risk. Delaying until conditions improve is recommended.`,
      };
    case "HOLD":
      return {
        label: "Hold before the dangerous stretch",
        summary: holdRecommendation
          ? `The early route appears more manageable, but conditions worsen ahead. Consider holding before ${holdRecommendation.holdBeforeLocationLabel} if you cannot clear the dangerous stretch before ${holdRecommendation.dangerBeginsAround}.`
          : `Conditions worsen later along the route near ${getCheckpointLabel(worstSample)}. Plan a conservative stop-before-danger decision.`,
      };
    case "AVOID":
      return {
        label: "Avoid this drive during the selected window",
        summary: `Severe driving hazards are forecast near ${getCheckpointLabel(worstSample)} around ${worstSample.etaDisplay}. Verify official warnings, closures, and advisories before considering travel.`,
      };
  }
}

export function buildTripDecision({
  samples,
  hazardWindows,
  summary,
  departureOptimization,
}: {
  samples: RouteSample[];
  hazardWindows: HazardWindow[];
  summary: RouteSummary;
  departureOptimization: DepartureOptimization;
}): TripDecision {
  const worstSample = samples.reduce(
    (currentWorst, sample) => (sample.score > currentWorst.score ? sample : currentWorst),
    samples[0],
  );
  const { confidence, reasons: confidenceReasons } = getConfidence(summary, samples);
  const mainHazards = getMainHazards(samples);
  const { selectedOption, windows: saferDepartureWindows } = buildSaferDepartureWindows(
    departureOptimization,
  );
  const saferDeparture = saferDepartureWindows[0];
  const holdRecommendation = buildHoldRecommendation(samples, hazardWindows);
  const sustainedHigh = hasConsecutiveRisk(samples, 2);
  const sustainedSevere = hasConsecutiveRisk(samples, 2, true);
  const hasFreezingPrecipitation = samples.some((sample) =>
    sample.factors.some((factor) => factor.key === "freezing-precipitation"),
  );

  let decision: TripDecisionLevel;

  if (
    (sustainedSevere || (hasFreezingPrecipitation && sustainedHigh)) &&
    !saferDeparture
  ) {
    decision = "AVOID";
  } else if (
    saferDeparture &&
    selectedOption &&
    (selectedOption.label === "High" || selectedOption.label === "Severe")
  ) {
    decision = "DELAY";
  } else if (holdRecommendation && (worstSample.label === "High" || worstSample.label === "Severe")) {
    decision = "HOLD";
  } else if (worstSample.label === "Severe") {
    decision = "AVOID";
  } else if (worstSample.label === "High" || sustainedHigh) {
    decision = "DELAY";
  } else if (worstSample.label === "Moderate") {
    decision = "CAUTION";
  } else {
    decision = "GO";
  }

  const copy = buildDecisionCopy({
    decision,
    worstSample,
    saferDeparture,
    holdRecommendation,
    mainHazards,
  });
  const dangerWindows = hazardWindows.map((window) => ({
    id: window.id,
    startTime: window.startEtaDisplay,
    endTime: window.endEtaDisplay,
    approximateLocationLabel: window.approximateLocationLabel,
    segmentIndexStart: window.startSampleIndex,
    segmentIndexEnd: window.endSampleIndex,
    maxRisk: window.label,
    hazardTypes: window.dominantFactors,
    summary: window.summary,
  }));
  const explanationBullets = [
    ...mainHazards.slice(0, 3),
    ...(sustainedHigh
      ? ["Two or more consecutive checkpoints are rated High or Severe."]
      : []),
    ...(worstSample.factors.some((factor) => factor.key === "night")
      ? ["The highest-risk portion of the drive occurs after dark."]
      : []),
  ].slice(0, 4);

  return {
    decision,
    decisionLabel: copy.label,
    decisionSummary: copy.summary,
    confidence,
    confidenceReasons,
    overallRisk: summary.overallLabel,
    worstSegmentRisk: worstSample.label,
    worstSegmentLocationLabel: getCheckpointLabel(worstSample),
    worstSegmentArrivalTime: worstSample.etaDisplay,
    mainHazards,
    dangerWindows,
    holdRecommendation,
    saferDepartureWindows,
    explanationBullets,
    dataQualityNotes: getDataQualityNotes(summary),
    safetyDisclaimer: SAFETY_DISCLAIMER,
  };
}
