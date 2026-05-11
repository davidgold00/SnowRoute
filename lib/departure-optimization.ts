import type { DepartureOptimization, DepartureTimeOption } from "@/lib/types";

function compareDepartureOptions(
  left: DepartureTimeOption,
  right: DepartureTimeOption,
) {
  if (left.overallScore !== right.overallScore) {
    return left.overallScore - right.overallScore;
  }

  if (left.maxScore !== right.maxScore) {
    return left.maxScore - right.maxScore;
  }

  if (left.hazardWindowCount !== right.hazardWindowCount) {
    return left.hazardWindowCount - right.hazardWindowCount;
  }

  if (left.dataQuality.incompleteWeatherSamples !== right.dataQuality.incompleteWeatherSamples) {
    return left.dataQuality.incompleteWeatherSamples - right.dataQuality.incompleteWeatherSamples;
  }

  if (left.averageScore !== right.averageScore) {
    return left.averageScore - right.averageScore;
  }

  return left.hour - right.hour;
}

function hasSameRiskProfile(left: DepartureTimeOption, right: DepartureTimeOption) {
  return (
    left.overallScore === right.overallScore &&
    left.maxScore === right.maxScore &&
    left.hazardWindowCount === right.hazardWindowCount &&
    left.averageScore === right.averageScore
  );
}

function formatBestTimes(times: string[]) {
  if (times.length <= 2) {
    return times.join(" or ");
  }

  return `${times.slice(0, -1).join(", ")}, or ${times.at(-1)}`;
}

function hasFullForecastCoverage(option: DepartureTimeOption) {
  return option.forecastCoverageRatio >= 1;
}

export function buildDepartureOptimization({
  travelDateDisplay,
  options,
}: {
  travelDateDisplay: string;
  options: DepartureTimeOption[];
}): DepartureOptimization {
  const fullyMatchedOptions = options.filter(hasFullForecastCoverage);
  const candidateOptions =
    fullyMatchedOptions.length > 0 ? fullyMatchedOptions : options;
  const sortedOptions = [...candidateOptions].sort(compareDepartureOptions);
  const bestOption = sortedOptions[0];

  if (!bestOption) {
    return {
      travelDateDisplay,
      summary: "No departure-time options were available for this travel day.",
      isEquallySafe: true,
      bestOptionIds: [],
      bestDepartureTimeDisplays: [],
      options,
    };
  }

  const bestOptions = sortedOptions.filter((option) =>
    hasSameRiskProfile(option, bestOption),
  );
  const isEquallySafe =
    bestOptions.length === options.length && candidateOptions.length === options.length;
  const bestDepartureTimeDisplays = bestOptions.map(
    (option) => option.departureTimeDisplay,
  );
  const hasIncompleteForecastCoverage = options.some(
    (option) => !hasFullForecastCoverage(option),
  );
  const coverageNote =
    fullyMatchedOptions.length > 0 && hasIncompleteForecastCoverage
      ? " Hours with incomplete forecast coverage are still shown, but SnowRoute does not promote them as safest."
      : hasIncompleteForecastCoverage
        ? " Forecast coverage is incomplete for this travel day, so treat the ranking as a planning signal rather than a final go/no-go call."
        : "";
  const summaryPrefix =
    fullyMatchedOptions.length > 0 && hasIncompleteForecastCoverage
      ? "Among fully matched forecast windows, "
      : "";

  const summary = isEquallySafe
    ? `All checked departure times on ${travelDateDisplay} are effectively equal for this route.${coverageNote}`
    : bestOptions.length === 1
      ? `${summaryPrefix}${bestOption.departureTimeDisplay} is the safest checked departure time on ${travelDateDisplay}.${coverageNote}`
      : `${summaryPrefix}${formatBestTimes(bestDepartureTimeDisplays)} are tied as the safest checked departure times on ${travelDateDisplay}.${coverageNote}`;

  return {
    travelDateDisplay,
    summary,
    isEquallySafe,
    bestOptionIds: bestOptions.map((option) => option.id),
    bestDepartureTimeDisplays,
    options,
  };
}
