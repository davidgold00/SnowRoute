import type {
  CityRelationship,
  CitySelection,
  EffectiveRouteEndpoint,
  LocationBoundingBox,
  LocationPrecision,
  LocationSuggestion,
  LocationType,
  PlacePrecision,
  PlaceSelection,
  PlaceType,
  RouteEndpointSelection,
} from "@/lib/types";

export type GeocodeFeature = {
  bbox?: [number, number, number, number];
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    id?: string;
    gid?: string;
    label?: string;
    source?: string;
    source_id?: string;
    country?: string;
    country_a?: string;
    region?: string;
    region_a?: string;
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
    match_type?: string;
    accuracy?: string;
    category?: string | string[];
  };
};

const UNIT_SUFFIX =
  /(?:\s*,?\s+)(?:(?:apt|apartment|unit|suite|ste|floor|fl)\.?\s*#?\s*[\p{L}\p{N}-]+|#\s*[\p{L}\p{N}-]+)\s*$/iu;
const CANADIAN_POSTAL_CODE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ][ -]?\d[ABCEGHJ-NPRSTVWXYZ]\d\b/i;
const US_POSTAL_CODE =
  /\b\d{5}(?:-\d{4})?\b(?=\s*(?:,\s*(?:US|USA|United States(?: of America)?))?\s*$)/i;
const INTERSECTION_QUERY = /(?:\s&\s|\s+and\s+|\s+at\s+)/i;

export function normalizeLocationQuery(query: string) {
  return query
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function normalizeLocationIdentity(value: string) {
  return normalizeLocationQuery(value)
    .toLocaleLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

export function stripAddressUnit(query: string) {
  const normalizedQuery = normalizeLocationQuery(query);
  const match = normalizedQuery.match(UNIT_SUFFIX);

  if (!match || match.index === undefined) {
    return {
      baseQuery: normalizedQuery,
      unitText: null,
    };
  }

  const baseQuery = normalizedQuery.slice(0, match.index).replace(/[\s,]+$/, "").trim();

  if (!baseQuery || !/\d/.test(baseQuery)) {
    return {
      baseQuery: normalizedQuery,
      unitText: null,
    };
  }

  return {
    baseQuery,
    unitText: match[0].replace(/^[\s,]+/, "").trim(),
  };
}

export function extractPostalCode(query: string, countryCode?: string | null) {
  const normalizedQuery = normalizeLocationQuery(query);
  const normalizedCountryCode = countryCode?.toUpperCase();
  const patterns =
    normalizedCountryCode === "CA" || normalizedCountryCode === "CAN"
      ? [CANADIAN_POSTAL_CODE]
      : normalizedCountryCode === "US" || normalizedCountryCode === "USA"
        ? [US_POSTAL_CODE]
        : [CANADIAN_POSTAL_CODE, US_POSTAL_CODE];

  for (const pattern of patterns) {
    const match = normalizedQuery.match(pattern);

    if (match?.[0]) {
      return {
        postalCode: match[0].toUpperCase().replace(
          /^([A-Z]\d[A-Z])([0-9A-Z]{3})$/,
          "$1 $2",
        ),
        queryWithoutPostalCode: normalizedQuery
          .replace(match[0], " ")
          .replace(/[\s,]+$/, "")
          .replace(/\s+/g, " ")
          .trim(),
      };
    }
  }

  return {
    postalCode: null,
    queryWithoutPostalCode: normalizedQuery,
  };
}

export function isAddressLikeQuery(query: string) {
  const normalizedQuery = normalizeLocationQuery(query);

  return (
    /^\d+[\p{L}]?(?:[-/]\d+)?\s+/u.test(normalizedQuery) ||
    INTERSECTION_QUERY.test(normalizedQuery) ||
    Boolean(extractPostalCode(normalizedQuery).postalCode)
  );
}

function compactLocationParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const normalizedPart = normalizeLocationIdentity(part);

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
    null
  );
}

function getLegacyLocality(feature: GeocodeFeature) {
  return getLocality(feature) ?? feature.properties?.county ?? null;
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
      // Pelias/openrouteservice point accuracy does not guarantee a rooftop.
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
      getLegacyLocality(feature),
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
    getLegacyLocality(feature),
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
          getLegacyLocality(feature),
          feature.properties?.region,
          feature.properties?.postalcode,
          feature.properties?.country,
        ]
      : [
          feature.properties?.street,
          feature.properties?.neighbourhood,
          getLegacyLocality(feature),
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

function getCoordinates(feature: GeocodeFeature) {
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates || !isValidCoordinate(coordinates[1], coordinates[0])) {
    return null;
  }

  return {
    latitude: coordinates[1],
    longitude: coordinates[0],
  };
}

function getProviderConfidence(feature: GeocodeFeature) {
  return typeof feature.properties?.confidence === "number"
    ? Math.min(1, Math.max(0, feature.properties.confidence))
    : null;
}

function normalizeBoundingBox(bbox: GeocodeFeature["bbox"]): LocationBoundingBox | null {
  if (
    !bbox ||
    bbox.length !== 4 ||
    !isValidCoordinate(bbox[1], bbox[0]) ||
    !isValidCoordinate(bbox[3], bbox[2]) ||
    bbox[1] > bbox[3]
  ) {
    return null;
  }

  return {
    west: bbox[0],
    south: bbox[1],
    east: bbox[2],
    north: bbox[3],
  };
}

export function normalizeGeocodeSuggestions(features: GeocodeFeature[]) {
  const seen = new Set<string>();

  return features.flatMap((feature): LocationSuggestion[] => {
    const coordinates = getCoordinates(feature);
    const label = createSuggestionLabel(feature);

    if (!coordinates || !label) {
      return [];
    }

    const providerId = feature.properties?.gid?.trim() || null;
    const identity =
      providerId ??
      `${label.toLocaleLowerCase()}|${coordinates.latitude.toFixed(6)}|${coordinates.longitude.toFixed(6)}`;

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
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        locality: cleanNullable(getLegacyLocality(feature)),
        region: cleanNullable(feature.properties?.region ?? feature.properties?.county),
        postalCode: cleanNullable(feature.properties?.postalcode, 32),
        country: cleanNullable(feature.properties?.country),
        countryCode: cleanNullable(feature.properties?.country_a, 8)?.toUpperCase() ?? null,
        detail: createSuggestionDetail(feature),
        placeType: getPlaceType(feature),
        locationType: getLocationType(feature),
        precision,
        isApproximate: ["postal", "city", "region", "unknown"].includes(precision),
        providerConfidence: getProviderConfidence(feature),
      },
    ];
  });
}

function scoreCity(city: CitySelection, query: string) {
  const normalizedQuery = normalizeLocationIdentity(query);
  const cityName = normalizeLocationIdentity(city.cityName);
  const displayName = normalizeLocationIdentity(city.displayName);
  let score = (city.providerConfidence ?? 0.5) * 20;

  if (cityName === normalizedQuery) {
    score += 100;
  } else if (cityName.startsWith(normalizedQuery)) {
    score += 70;
  } else if (displayName.includes(normalizedQuery)) {
    score += 35;
  }

  return score;
}

export function normalizeCitySuggestions(features: GeocodeFeature[], query: string) {
  const seenProviderIds = new Set<string>();
  const seenSemanticKeys = new Set<string>();

  return features
    .flatMap((feature): CitySelection[] => {
      const layer = feature.properties?.layer;

      if (layer !== "locality" && layer !== "localadmin") {
        return [];
      }

      const coordinates = getCoordinates(feature);
      const cityName = cleanNullable(
        feature.properties?.locality ??
          feature.properties?.localadmin ??
          feature.properties?.name,
        160,
      );
      const countryName = cleanNullable(feature.properties?.country, 160);
      const countryCode = cleanNullable(feature.properties?.country_a, 3)?.toUpperCase();

      if (!coordinates || !cityName || !countryName || !countryCode) {
        return [];
      }

      const providerId = cleanNullable(feature.properties?.gid, 240);
      const semanticKey = [
        normalizeLocationIdentity(cityName),
        normalizeLocationIdentity(feature.properties?.region ?? ""),
        countryCode,
        coordinates.latitude.toFixed(4),
        coordinates.longitude.toFixed(4),
      ].join("|");

      if (
        (providerId && seenProviderIds.has(providerId)) ||
        seenSemanticKeys.has(semanticKey)
      ) {
        return [];
      }

      if (providerId) {
        seenProviderIds.add(providerId);
      }
      seenSemanticKeys.add(semanticKey);

      const displayName =
        cleanNullable(feature.properties?.label, 240) ??
        compactLocationParts([
          cityName,
          feature.properties?.region,
          countryName,
        ]).join(", ");

      return [
        {
          providerId,
          displayName,
          cityName,
          regionName: cleanNullable(feature.properties?.region),
          regionCode: cleanNullable(feature.properties?.region_a, 32),
          countryName,
          countryCode,
          postalCode: cleanNullable(feature.properties?.postalcode, 32),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          boundingBox: normalizeBoundingBox(feature.bbox),
          timezone: null,
          precision: layer === "localadmin" ? "municipality" : "locality",
          providerConfidence: getProviderConfidence(feature),
        },
      ];
    })
    .sort((left, right) => scoreCity(right, query) - scoreCity(left, query));
}

export function distanceBetweenLocationsKm(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(right.latitude - left.latitude);
  const lonDelta = toRadians(right.longitude - left.longitude);
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function isInsideBoundingBox(
  point: { latitude: number; longitude: number },
  bounds: LocationBoundingBox,
) {
  const longitudeInside =
    bounds.west <= bounds.east
      ? point.longitude >= bounds.west && point.longitude <= bounds.east
      : point.longitude >= bounds.west || point.longitude <= bounds.east;

  return (
    longitudeInside &&
    point.latitude >= bounds.south &&
    point.latitude <= bounds.north
  );
}

function getNearCityRadiusKm(city: CitySelection) {
  if (!city.boundingBox) {
    return 35;
  }

  const diagonalKm = distanceBetweenLocationsKm(
    {
      latitude: city.boundingBox.south,
      longitude: city.boundingBox.west,
    },
    {
      latitude: city.boundingBox.north,
      longitude: city.boundingBox.east,
    },
  );

  return Math.min(80, Math.max(35, diagonalKm * 0.75));
}

export function classifyCityRelationship(
  city: CitySelection,
  place: Pick<
    PlaceSelection,
    "latitude" | "longitude" | "cityName" | "regionName" | "countryCode"
  >,
): CityRelationship {
  const countryAliases: Record<string, string> = {
    USA: "US",
    CAN: "CA",
    GBR: "GB",
    MEX: "MX",
  };
  const selectedCountryCode = city.countryCode.toUpperCase();
  const placeCountryCode = place.countryCode?.toUpperCase();
  const selectedCountry = countryAliases[selectedCountryCode] ?? selectedCountryCode;
  const placeCountry = placeCountryCode
    ? countryAliases[placeCountryCode] ?? placeCountryCode
    : null;

  if (placeCountry && placeCountry !== selectedCountry) {
    return "OUTSIDE_SELECTED_CITY";
  }

  const selectedCityName = normalizeLocationIdentity(city.cityName);
  const placeCityName = place.cityName
    ? normalizeLocationIdentity(place.cityName)
    : null;
  const selectedRegionName = city.regionName
    ? normalizeLocationIdentity(city.regionName)
    : null;
  const placeRegionName = place.regionName
    ? normalizeLocationIdentity(place.regionName)
    : null;
  const regionExplicitlyDiffers = Boolean(
    selectedRegionName && placeRegionName && selectedRegionName !== placeRegionName,
  );
  const point = { latitude: place.latitude, longitude: place.longitude };

  if (
    placeCityName &&
    placeCityName === selectedCityName &&
    !regionExplicitlyDiffers
  ) {
    return "WITHIN_SELECTED_CITY";
  }

  if (city.boundingBox && isInsideBoundingBox(point, city.boundingBox)) {
    return "WITHIN_SELECTED_CITY";
  }

  const distanceKm = distanceBetweenLocationsKm(city, point);
  const regionMatches =
    !place.regionName ||
    !city.regionName ||
    normalizeLocationIdentity(place.regionName) ===
      normalizeLocationIdentity(city.regionName);

  if (regionMatches && distanceKm <= getNearCityRadiusKm(city)) {
    return "NEAR_SELECTED_CITY";
  }

  if (placeCityName || placeCountry || place.regionName) {
    return "OUTSIDE_SELECTED_CITY";
  }

  return "CITY_MEMBERSHIP_UNKNOWN";
}

function getProviderCategories(feature: GeocodeFeature) {
  const category = feature.properties?.category;

  return Array.isArray(category) ? category : category ? [category] : [];
}

function getStructuredPlaceType(feature: GeocodeFeature): PlaceType {
  switch (feature.properties?.layer) {
    case "address":
      return "address";
    case "street":
      return "street";
    case "postalcode":
      return "postal";
    case "venue": {
      const classificationText = [
        feature.properties?.name,
        feature.properties?.label,
        ...getProviderCategories(feature),
      ]
        .filter((part): part is string => Boolean(part))
        .join(" ")
        .toLocaleLowerCase();

      if (/airport|aerodrome|airfield/.test(classificationText)) {
        return "airport";
      }

      if (/transit|railway|train station|bus station|metro|subway|tram/.test(classificationText)) {
        return "transit";
      }

      if (
        /landmark|monument|museum|park|university|school|hospital|resort|mall|stadium/.test(
          classificationText,
        )
      ) {
        return "landmark";
      }

      return "business";
    }
    default:
      return "unknown";
  }
}

function getStructuredPlacePrecision(
  feature: GeocodeFeature,
  query: string,
): PlacePrecision {
  switch (feature.properties?.layer) {
    case "address":
      return "street";
    case "street":
      return INTERSECTION_QUERY.test(query) ? "intersection" : "street";
    case "postalcode":
      return "postal";
    case "venue":
      return "approximate";
    default:
      return "unknown";
  }
}

function formatPlaceType(placeType: PlaceType) {
  switch (placeType) {
    case "airport":
      return "Airport";
    case "transit":
      return "Transit";
    case "landmark":
      return "Landmark";
    case "business":
      return "Business";
    case "address":
      return "Address";
    case "street":
      return "Street";
    case "postal":
      return "Postal area";
    case "coordinates":
      return "Coordinates";
    default:
      return "Location";
  }
}

function scorePlace(place: PlaceSelection, city: CitySelection, query: string) {
  const normalizedQuery = normalizeLocationIdentity(query);
  const primaryText = normalizeLocationIdentity(place.primaryText);
  const formattedAddress = normalizeLocationIdentity(place.formattedAddress);
  const addressLike = isAddressLikeQuery(query);
  const relationshipScore: Record<CityRelationship, number> = {
    WITHIN_SELECTED_CITY: 120,
    NEAR_SELECTED_CITY: 75,
    CITY_MEMBERSHIP_UNKNOWN: 35,
    OUTSIDE_SELECTED_CITY: 0,
  };
  let score = relationshipScore[place.cityRelationship];

  if (primaryText === normalizedQuery || formattedAddress.startsWith(normalizedQuery)) {
    score += 60;
  } else if (primaryText.startsWith(normalizedQuery)) {
    score += 42;
  } else if (formattedAddress.includes(normalizedQuery)) {
    score += 24;
  }

  if (addressLike && place.placeType === "address") {
    score += 30;
  }

  if (!addressLike && ["business", "landmark", "airport", "transit"].includes(place.placeType)) {
    score += 22;
  }

  if (place.matchType?.toLocaleLowerCase() === "exact") {
    score += 14;
  }

  score += (place.providerConfidence ?? 0.5) * 20;
  score -= Math.min(25, distanceBetweenLocationsKm(city, place) / 4);

  return score;
}

function getPlaceSemanticKey(place: PlaceSelection) {
  if (place.placeType === "street" || place.placeType === "postal") {
    return `${place.placeType}|${normalizeLocationIdentity(place.formattedAddress)}`;
  }

  return null;
}

export function rankAndDeduplicatePlaces(
  places: PlaceSelection[],
  city: CitySelection,
  query: string,
) {
  const seenProviderIds = new Set<string>();
  const seenSemanticKeys = new Set<string>();

  return places
    .filter((place) => {
      if (place.providerId && seenProviderIds.has(place.providerId)) {
        return false;
      }

      const semanticKey = getPlaceSemanticKey(place);

      if (semanticKey && seenSemanticKeys.has(semanticKey)) {
        return false;
      }

      if (place.providerId) {
        seenProviderIds.add(place.providerId);
      }
      if (semanticKey) {
        seenSemanticKeys.add(semanticKey);
      }
      return true;
    })
    .sort((left, right) => scorePlace(right, city, query) - scorePlace(left, city, query));
}

export function normalizePlaceSuggestions(
  features: GeocodeFeature[],
  city: CitySelection,
  query: string,
) {
  const normalized = features.flatMap((feature): PlaceSelection[] => {
    const coordinates = getCoordinates(feature);

    if (!coordinates) {
      return [];
    }

    const formattedAddress = createSuggestionLabel(feature).slice(0, 320);

    if (!formattedAddress) {
      return [];
    }

    const primaryText =
      [feature.properties?.housenumber, feature.properties?.street]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(" ") ||
      cleanNullable(feature.properties?.name, 180) ||
      formattedAddress.split(",")[0]?.trim() ||
      formattedAddress;
    const placeType = getStructuredPlaceType(feature);
    const context = compactLocationParts([
      getLocality(feature),
      feature.properties?.region,
      feature.properties?.postalcode,
      feature.properties?.country,
    ]).join(", ");
    const candidate = {
      providerId: cleanNullable(feature.properties?.gid, 240),
      displayName: primaryText.slice(0, 240),
      formattedAddress,
      primaryText: primaryText.slice(0, 180),
      secondaryText: `${context || formattedAddress} · ${formatPlaceType(placeType)}`.slice(
        0,
        240,
      ),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      placeType,
      precision: getStructuredPlacePrecision(feature, query),
      cityName: cleanNullable(getLocality(feature)),
      regionName: cleanNullable(feature.properties?.region),
      countryCode:
        cleanNullable(feature.properties?.country_a, 3)?.toUpperCase() ?? null,
      postalCode: cleanNullable(feature.properties?.postalcode, 32),
      cityRelationship: "CITY_MEMBERSHIP_UNKNOWN" as CityRelationship,
      providerConfidence: getProviderConfidence(feature),
      matchType: cleanNullable(feature.properties?.match_type, 80),
      source: cleanNullable(feature.properties?.source, 80),
    } satisfies PlaceSelection;

    return [
      {
        ...candidate,
        cityRelationship: classifyCityRelationship(city, candidate),
      },
    ];
  });

  return rankAndDeduplicatePlaces(normalized, city, query);
}

export function buildQualifiedPlaceQuery(query: string, city: CitySelection) {
  const normalizedQuery = normalizeLocationQuery(query);
  const queryIdentity = normalizeLocationIdentity(normalizedQuery);
  const queryTokens = new Set(queryIdentity.split(" "));
  const hasContext = (value: string | null | undefined) =>
    Boolean(value && queryIdentity.includes(normalizeLocationIdentity(value)));
  const hasCountryCode = queryTokens.has(
    normalizeLocationIdentity(city.countryCode),
  );

  return compactLocationParts([
    normalizedQuery,
    hasContext(city.cityName) ? null : city.cityName,
    hasContext(city.regionName) ? null : city.regionName,
    hasContext(city.countryName) || hasCountryCode
      ? null
      : city.countryName,
  ]).join(", ");
}

export function createRouteEndpointSelection(
  city: CitySelection,
  place: PlaceSelection | null = null,
): RouteEndpointSelection {
  if (place) {
    return {
      city,
      place,
      effectiveLatitude: place.latitude,
      effectiveLongitude: place.longitude,
      effectiveDisplayName: place.formattedAddress.slice(0, 240),
      effectiveFormattedAddress: place.formattedAddress,
      usesCityFallback: false,
    };
  }

  return {
    city,
    place: null,
    effectiveLatitude: city.latitude,
    effectiveLongitude: city.longitude,
    effectiveDisplayName: `Central ${city.cityName}`,
    effectiveFormattedAddress: `Central ${city.displayName}`,
    usesCityFallback: true,
  };
}

export function toEffectiveRouteEndpoint(
  endpoint: RouteEndpointSelection,
): EffectiveRouteEndpoint {
  return {
    latitude: endpoint.effectiveLatitude,
    longitude: endpoint.effectiveLongitude,
    displayName: endpoint.effectiveDisplayName,
    formattedAddress: endpoint.effectiveFormattedAddress,
    placeType: endpoint.place?.placeType ?? "unknown",
    precision: endpoint.place?.precision ?? endpoint.city.precision,
    usesCityFallback: endpoint.usesCityFallback,
  };
}
