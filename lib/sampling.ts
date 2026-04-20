import type { Coordinate, RiskLabel, RouteSegment } from "@/lib/types";

type ProjectedPoint = {
  coordinate: Coordinate;
  segmentIndex: number;
  segmentFraction: number;
};

export type SampleProjection = {
  coordinate: Coordinate;
  distanceKm: number;
  etaUtc: string;
};

type SegmentableSample = {
  id: string;
  coordinate: Coordinate;
  distanceKm: number;
  score: number;
  label: RiskLabel;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function haversineDistanceKm(a: Coordinate, b: Coordinate) {
  const earthRadiusKm = 6371;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLon = ((b.lon - a.lon) * Math.PI) / 180;

  const haversineValue =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
  );
}

export function buildCumulativeDistances(coordinates: Coordinate[]) {
  if (coordinates.length === 0) {
    return [];
  }

  const cumulativeDistances = [0];

  for (let index = 1; index < coordinates.length; index += 1) {
    cumulativeDistances.push(
      cumulativeDistances[index - 1] +
        haversineDistanceKm(coordinates[index - 1], coordinates[index]),
    );
  }

  return cumulativeDistances;
}

export function getSampleCount(distanceKm: number) {
  return clamp(Math.ceil(distanceKm / 20), 12, 48);
}

export function interpolateAlongRoute(
  coordinates: Coordinate[],
  cumulativeDistances: number[],
  targetDistanceKm: number,
): ProjectedPoint {
  if (coordinates.length === 0 || cumulativeDistances.length === 0) {
    throw new Error("Cannot interpolate an empty route.");
  }

  const totalDistanceKm = cumulativeDistances.at(-1) ?? 0;

  if (targetDistanceKm <= 0 || coordinates.length === 1) {
    return {
      coordinate: coordinates[0],
      segmentIndex: 0,
      segmentFraction: 0,
    };
  }

  if (targetDistanceKm >= totalDistanceKm) {
    return {
      coordinate: coordinates.at(-1) ?? coordinates[0],
      segmentIndex: Math.max(coordinates.length - 2, 0),
      segmentFraction: 1,
    };
  }

  let upperIndex = 1;

  while (
    upperIndex < cumulativeDistances.length &&
    cumulativeDistances[upperIndex] < targetDistanceKm
  ) {
    upperIndex += 1;
  }

  const lowerIndex = Math.max(upperIndex - 1, 0);
  const lowerDistanceKm = cumulativeDistances[lowerIndex];
  const upperDistanceKm = cumulativeDistances[upperIndex];

  if (upperDistanceKm <= lowerDistanceKm) {
    return {
      coordinate: coordinates[upperIndex],
      segmentIndex: lowerIndex,
      segmentFraction: 1,
    };
  }

  const segmentFraction =
    (targetDistanceKm - lowerDistanceKm) / (upperDistanceKm - lowerDistanceKm);

  return {
    coordinate: {
      lat: lerp(
        coordinates[lowerIndex].lat,
        coordinates[upperIndex].lat,
        segmentFraction,
      ),
      lon: lerp(
        coordinates[lowerIndex].lon,
        coordinates[upperIndex].lon,
        segmentFraction,
      ),
    },
    segmentIndex: lowerIndex,
    segmentFraction,
  };
}

export function sampleRoute({
  coordinates,
  departureTimeUtc,
  durationMinutes,
}: {
  coordinates: Coordinate[];
  departureTimeUtc: string;
  durationMinutes: number;
}) {
  const cumulativeDistances = buildCumulativeDistances(coordinates);

  if (coordinates.length === 0 || cumulativeDistances.length === 0) {
    throw new Error("A route requires at least one coordinate.");
  }

  const totalDistanceKm = cumulativeDistances.at(-1) ?? 0;
  const sampleCount = getSampleCount(totalDistanceKm);
  const departureTimeMs = new Date(departureTimeUtc).getTime();
  const durationMs = Math.max(durationMinutes, 0) * 60 * 1000;
  const projections: SampleProjection[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const distanceKm = totalDistanceKm * progress;
    const projectedPoint = interpolateAlongRoute(
      coordinates,
      cumulativeDistances,
      distanceKm,
    );

    projections.push({
      coordinate: projectedPoint.coordinate,
      distanceKm,
      etaUtc: new Date(departureTimeMs + durationMs * progress).toISOString(),
    });
  }

  return projections;
}

export function buildRiskSegments(
  routeCoordinates: Coordinate[],
  samples: SegmentableSample[],
) {
  const cumulativeDistances = buildCumulativeDistances(routeCoordinates);
  const segments: RouteSegment[] = [];

  if (samples.length < 2) {
    return segments;
  }

  for (let index = 0; index < samples.length - 1; index += 1) {
    const startSample = samples[index];
    const endSample = samples[index + 1];
    const segmentCoordinates: Coordinate[] = [startSample.coordinate];

    for (let pointIndex = 1; pointIndex < cumulativeDistances.length - 1; pointIndex += 1) {
      const distanceKm = cumulativeDistances[pointIndex];

      if (distanceKm > startSample.distanceKm && distanceKm < endSample.distanceKm) {
        segmentCoordinates.push(routeCoordinates[pointIndex]);
      }
    }

    segmentCoordinates.push(endSample.coordinate);

    segments.push({
      id: `segment-${index + 1}`,
      coordinates: segmentCoordinates,
      score: Math.max(startSample.score, endSample.score),
      label:
        startSample.score >= endSample.score ? startSample.label : endSample.label,
      fromSampleId: startSample.id,
      toSampleId: endSample.id,
    });
  }

  return segments;
}
