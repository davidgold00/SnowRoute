import type {
  LocationPrecision,
  LocationSuggestion,
  LocationType,
} from "@/lib/types";

export type GeocodeFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    gid?: string;
    label?: string;
    country?: string;
    country_a?: string;
    region?: string;
    county?: string;
    locality?: string;
    localadmin?: string;
    borough?: string;
    neighbourhood?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postalcode?: string;
    layer?: string;
    confidence?: number;
    accuracy?: string;
  };
};

export function normalizeLocationQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function compactLocationParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const normalizedPart = part.toLocaleLowerCase();

      if (seen.has(normalizedPart)) {
        return false;
      }

      seen.add(normalizedPart);
      return true;
    });
}

function cleanNullable(value: string | null | undefined, maxLength = 120) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function getLocality(feature: GeocodeFeature) {
  return (
    feature.properties?.locality ??
    feature.properties?.localadmin ??
    feature.properties?.borough ??
    feature.properties?.county ??
    null
  );
}

function getPlaceType(feature: GeocodeFeature): LocationSuggestion["placeType"] {
  switch (feature.properties?.layer) {
    case "address":
      return "Address";
    case "venue":
      return "Place";
    case "street":
      return "Street";
    case "locality":
    case "localadmin":
      return "City";
    default:
      return "Region";
  }
}

function getLocationType(feature: GeocodeFeature): LocationType {
  switch (feature.properties?.layer) {
    case "address":
      return "address";
    case "venue":
      return "business";
    case "street":
      return "street";
    case "locality":
    case "localadmin":
      return "city";
    case "postalcode":
      return "postal";
    case "region":
    case "county":
      return "region";
    default:
      return "unknown";
  }
}

function getPrecision(feature: GeocodeFeature): LocationPrecision {
  switch (feature.properties?.layer) {
    case "address":
    case "street":
      // Pelias/OpenRouteService does not guarantee rooftop accuracy. Treat even
      // house-number results conservatively as street-level matches.
      return "street";
    case "postalcode":
      return "postal";
    case "locality":
    case "localadmin":
      return "city";
    case "region":
    case "county":
      return "region";
    default:
      return "unknown";
  }
}

function createSuggestionLabel(feature: GeocodeFeature) {
  const streetAddress = [feature.properties?.housenumber, feature.properties?.street]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  if (streetAddress) {
    return compactLocationParts([
      streetAddress,
      getLocality(feature),
      feature.properties?.region,
      feature.properties?.postalcode,
      feature.properties?.country,
    ]).join(", ");
  }

  const providerLabel = feature.properties?.label?.trim();

  if (providerLabel) {
    return providerLabel;
  }

  return compactLocationParts([
    feature.properties?.name,
    getLocality(feature),
    feature.properties?.region,
    feature.properties?.country,
  ]).join(", ");
}

function createSuggestionDetail(feature: GeocodeFeature) {
  const placeType = getPlaceType(feature);
  const details =
    placeType === "Address"
      ? [
          feature.properties?.neighbourhood,
          getLocality(feature),
          feature.properties?.region,
          feature.properties?.postalcode,
          feature.properties?.country,
        ]
      : [
          feature.properties?.street,
          feature.properties?.neighbourhood,
          getLocality(feature),
          feature.properties?.region,
          feature.properties?.postalcode,
          feature.properties?.country,
        ];
  const compactDetails = compactLocationParts(details);

  return compactDetails.length > 0 ? compactDetails.join(" • ") : null;
}

function isValidCoordinate(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function normalizeGeocodeSuggestions(features: GeocodeFeature[]) {
  const seen = new Set<string>();

  return features.flatMap((feature): LocationSuggestion[] => {
    const coordinates = feature.geometry?.coordinates;
    const label = createSuggestionLabel(feature);

    if (!coordinates || !label || !isValidCoordinate(coordinates[1], coordinates[0])) {
      return [];
    }

    const lat = coordinates[1];
    const lon = coordinates[0];
    const providerId = feature.properties?.gid?.trim() || null;
    const identity = providerId ?? `${label.toLocaleLowerCase()}|${lat.toFixed(6)}|${lon.toFixed(6)}`;

    if (seen.has(identity)) {
      return [];
    }

    seen.add(identity);
    const precision = getPrecision(feature);
    const formattedAddress = label.slice(0, 240);

    return [
      {
        id: providerId ?? identity,
        providerId,
        label: formattedAddress,
        formattedAddress,
        primaryLabel:
          [feature.properties?.housenumber, feature.properties?.street]
            .filter((part): part is string => Boolean(part?.trim()))
            .join(" ") ||
          feature.properties?.name?.trim().slice(0, 180) ||
          formattedAddress.split(",")[0]?.trim() ||
          formattedAddress,
        lat,
        lon,
        locality: cleanNullable(getLocality(feature)),
        region: cleanNullable(feature.properties?.region ?? feature.properties?.county),
        postalCode: cleanNullable(feature.properties?.postalcode, 32),
        country: cleanNullable(feature.properties?.country),
        countryCode: cleanNullable(feature.properties?.country_a, 8)?.toUpperCase() ?? null,
        detail: createSuggestionDetail(feature),
        placeType: getPlaceType(feature),
        locationType: getLocationType(feature),
        precision,
        isApproximate: ["postal", "city", "region", "unknown"].includes(precision),
        providerConfidence:
          typeof feature.properties?.confidence === "number"
            ? Math.min(1, Math.max(0, feature.properties.confidence))
            : null,
      },
    ];
  });
}
