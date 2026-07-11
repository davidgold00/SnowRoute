import {
  citiesAreEquivalent,
  createRouteEndpointSelection,
} from "@/lib/route-location-state";
import {
  routeEndpointSelectionSchema,
  type ForecastConfidence,
  type LocationSuggestion,
  type RiskLabel,
  type RouteEndpointSelection,
  type TripDecisionLevel,
} from "@/lib/types";

export const GUEST_TRIP_HISTORY_LIMIT = 20;

const HISTORY_VERSION = 2 as const;
const LEGACY_HISTORY_VERSION = 1 as const;
const DATABASE_NAME = "snowroute-local-data";
const DATABASE_VERSION = 2;
const HISTORY_STORE_NAME = "trip-history";
const LOCAL_STORAGE_KEY = "snowroute.guestTripHistory.v2";
const LEGACY_LOCAL_STORAGE_KEY = "snowroute.guestTripHistory.v1";
const RESTORE_STORAGE_KEY = "snowroute.tripHistoryRestore.v2";
const LEGACY_RESTORE_STORAGE_KEY = "snowroute.tripHistoryRestore.v1";
const HISTORY_CHANGED_EVENT = "snowroute:guest-history-changed";
const LEGACY_GEOCODER_PROVIDER = "openrouteservice Geocoding API";

const DECISIONS: TripDecisionLevel[] = ["GO", "CAUTION", "DELAY", "HOLD", "AVOID"];
const RISK_LABELS: RiskLabel[] = ["Low", "Moderate", "High", "Severe"];
const CONFIDENCE_LEVELS: ForecastConfidence[] = ["High", "Medium", "Low"];
const PLACE_TYPES: LocationSuggestion["placeType"][] = [
  "Address",
  "Place",
  "Street",
  "City",
  "Region",
];
const LOCATION_TYPES: Array<NonNullable<LocationSuggestion["locationType"]>> = [
  "address",
  "business",
  "street",
  "city",
  "postal",
  "region",
  "landmark",
  "coordinates",
  "unknown",
];
const LOCATION_PRECISIONS: Array<NonNullable<LocationSuggestion["precision"]>> = [
  "rooftop",
  "parcel",
  "street",
  "postal",
  "city",
  "region",
  "unknown",
];

type GuestTripAnalysisFields = {
  departureTimeLocal: string;
  departureTimeUtc: string;
  timeZone: string;
  decision: TripDecisionLevel;
  decisionLabel: string;
  decisionSummary: string;
  overallRisk: RiskLabel;
  confidence: ForecastConfidence;
  mainHazards: string[];
  worstSegmentRisk: RiskLabel;
  worstSegmentLocationLabel: string;
  worstSegmentArrivalTime: string;
  riskModelVersion: string;
  distanceKm: number;
  durationMinutes: number;
};

export type GuestTripHistoryEntry = GuestTripAnalysisFields & {
  version: typeof HISTORY_VERSION;
  id: string;
  fingerprint: string;
  analyzedAt: string;
  originEndpoint: RouteEndpointSelection | null;
  destinationEndpoint: RouteEndpointSelection | null;
  legacyOrigin: LocationSuggestion | null;
  legacyDestination: LocationSuggestion | null;
  sameCity: boolean;
  requiresCityConfirmation: boolean;
  waypoints: LocationSuggestion[];
  geocoderProvider: string;
};

export type NewGuestTripHistoryEntry = GuestTripAnalysisFields & {
  originEndpoint: RouteEndpointSelection;
  destinationEndpoint: RouteEndpointSelection;
  sameCity: boolean;
  waypoints: LocationSuggestion[];
  geocoderProvider: string;
};

type HistoryEnvelope = {
  version: typeof HISTORY_VERSION;
  entries: GuestTripHistoryEntry[];
};

type FingerprintInput = Pick<
  GuestTripHistoryEntry,
  | "originEndpoint"
  | "destinationEndpoint"
  | "legacyOrigin"
  | "legacyDestination"
  | "sameCity"
  | "waypoints"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function boundedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function optionalStringOrNull(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

function syntheticLegacyLocationId(label: string, lat: number, lon: number) {
  const normalizedLabel = label
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `legacy-${lat.toFixed(5)}-${lon.toFixed(5)}-${normalizedLabel || "location"}`;
}

function parseLegacyLocation(value: unknown): LocationSuggestion | null {
  if (
    !isRecord(value) ||
    typeof value.label !== "string" ||
    !isFiniteCoordinate(value.lat, -90, 90) ||
    !isFiniteCoordinate(value.lon, -180, 180)
  ) {
    return null;
  }

  const label = value.label.trim().slice(0, 240);

  if (!label) {
    return null;
  }

  const locationType = LOCATION_TYPES.includes(
    value.locationType as NonNullable<LocationSuggestion["locationType"]>,
  )
    ? (value.locationType as NonNullable<LocationSuggestion["locationType"]>)
    : "unknown";
  const precision = LOCATION_PRECISIONS.includes(
    value.precision as NonNullable<LocationSuggestion["precision"]>,
  )
    ? (value.precision as NonNullable<LocationSuggestion["precision"]>)
    : "unknown";
  const placeType = PLACE_TYPES.includes(value.placeType as LocationSuggestion["placeType"])
    ? (value.placeType as LocationSuggestion["placeType"])
    : locationType === "city"
      ? "City"
      : locationType === "region"
        ? "Region"
        : "Place";
  const providerConfidence =
    typeof value.providerConfidence === "number" &&
    Number.isFinite(value.providerConfidence) &&
    value.providerConfidence >= 0 &&
    value.providerConfidence <= 1
      ? value.providerConfidence
      : null;

  return {
    id:
      boundedString(value.id, 240) ??
      syntheticLegacyLocationId(label, value.lat, value.lon),
    providerId: optionalStringOrNull(value.providerId),
    label,
    formattedAddress: boundedString(value.formattedAddress, 240) ?? label,
    primaryLabel:
      boundedString(value.primaryLabel, 180) ?? label.split(",")[0]?.trim() ?? label,
    lat: value.lat,
    lon: value.lon,
    locality: optionalStringOrNull(value.locality),
    country: optionalStringOrNull(value.country, 160),
    countryCode: optionalStringOrNull(value.countryCode, 8)?.toUpperCase() ?? null,
    region: optionalStringOrNull(value.region, 160),
    postalCode: optionalStringOrNull(value.postalCode, 32),
    detail: optionalStringOrNull(value.detail),
    placeType,
    locationType,
    precision,
    isApproximate:
      typeof value.isApproximate === "boolean"
        ? value.isApproximate
        : ["postal", "city", "region", "unknown"].includes(precision),
    providerConfidence,
  };
}

function parseEndpoint(value: unknown): RouteEndpointSelection | null {
  const parsed = routeEndpointSelectionSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return createRouteEndpointSelection(parsed.data.city, parsed.data.place ?? null);
}

function parseWaypoints(value: unknown) {
  return (Array.isArray(value)
    ? value
        .map(parseLegacyLocation)
        .filter((item): item is LocationSuggestion => item !== null)
    : []
  ).slice(0, 2);
}

function parseStoredAnalysisFields(value: Record<string, unknown>) {
  const id = boundedString(value.id, 180);
  const analyzedAtMs = typeof value.analyzedAt === "string" ? Date.parse(value.analyzedAt) : NaN;
  const departureTimeUtcMs =
    typeof value.departureTimeUtc === "string" ? Date.parse(value.departureTimeUtc) : NaN;
  const departureTimeLocal = boundedString(value.departureTimeLocal, 32);
  const timeZone = boundedString(value.timeZone, 120);
  const decisionLabel = boundedString(value.decisionLabel, 120);
  const decisionSummary = boundedString(value.decisionSummary, 600);
  const worstSegmentLocationLabel = boundedString(value.worstSegmentLocationLabel, 240);
  const worstSegmentArrivalTime = boundedString(value.worstSegmentArrivalTime, 160);
  const riskModelVersion = boundedString(value.riskModelVersion, 80);

  if (
    !id ||
    !Number.isFinite(analyzedAtMs) ||
    !departureTimeLocal ||
    !Number.isFinite(departureTimeUtcMs) ||
    !timeZone ||
    !DECISIONS.includes(value.decision as TripDecisionLevel) ||
    !decisionLabel ||
    !decisionSummary ||
    !RISK_LABELS.includes(value.overallRisk as RiskLabel) ||
    !CONFIDENCE_LEVELS.includes(value.confidence as ForecastConfidence) ||
    !RISK_LABELS.includes(value.worstSegmentRisk as RiskLabel) ||
    !worstSegmentLocationLabel ||
    !worstSegmentArrivalTime ||
    !riskModelVersion ||
    typeof value.distanceKm !== "number" ||
    !Number.isFinite(value.distanceKm) ||
    value.distanceKm < 0 ||
    typeof value.durationMinutes !== "number" ||
    !Number.isFinite(value.durationMinutes) ||
    value.durationMinutes < 0
  ) {
    return null;
  }

  return {
    id,
    analyzedAt: new Date(analyzedAtMs).toISOString(),
    departureTimeLocal,
    departureTimeUtc: new Date(departureTimeUtcMs).toISOString(),
    timeZone,
    decision: value.decision as TripDecisionLevel,
    decisionLabel,
    decisionSummary,
    overallRisk: value.overallRisk as RiskLabel,
    confidence: value.confidence as ForecastConfidence,
    mainHazards: Array.isArray(value.mainHazards)
      ? value.mainHazards
          .filter((item): item is string => typeof item === "string")
          .slice(0, 5)
          .map((item) => item.trim().slice(0, 160))
          .filter(Boolean)
      : [],
    worstSegmentRisk: value.worstSegmentRisk as RiskLabel,
    worstSegmentLocationLabel,
    worstSegmentArrivalTime,
    riskModelVersion,
    distanceKm: value.distanceKm,
    durationMinutes: value.durationMinutes,
  } satisfies GuestTripAnalysisFields & { id: string; analyzedAt: string };
}

function normalizeFingerprintText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function endpointFingerprint(endpoint: RouteEndpointSelection) {
  const selectedIdentity = endpoint.place
    ? endpoint.place.providerId ?? normalizeFingerprintText(endpoint.place.formattedAddress)
    : endpoint.city.providerId ?? normalizeFingerprintText(endpoint.city.displayName);

  return [
    endpoint.usesCityFallback ? "city" : "place",
    selectedIdentity,
    endpoint.effectiveLatitude.toFixed(5),
    endpoint.effectiveLongitude.toFixed(5),
  ].join(":");
}

function legacyLocationFingerprint(location: LocationSuggestion) {
  return [
    "legacy",
    location.providerId ?? normalizeFingerprintText(location.label),
    location.lat.toFixed(5),
    location.lon.toFixed(5),
  ].join(":");
}

function waypointFingerprint(location: LocationSuggestion) {
  return [
    location.providerId ?? normalizeFingerprintText(location.label),
    location.lat.toFixed(5),
    location.lon.toFixed(5),
  ].join(":");
}

export function createGuestTripFingerprint(input: FingerprintInput) {
  const origin = input.originEndpoint
    ? endpointFingerprint(input.originEndpoint)
    : input.legacyOrigin
      ? legacyLocationFingerprint(input.legacyOrigin)
      : "missing-origin";
  const destination = input.destinationEndpoint
    ? endpointFingerprint(input.destinationEndpoint)
    : input.legacyDestination
      ? legacyLocationFingerprint(input.legacyDestination)
      : "missing-destination";

  return [
    `same-city:${input.sameCity ? "yes" : "no"}`,
    origin,
    ...input.waypoints.map((waypoint) => `stop:${waypointFingerprint(waypoint)}`),
    destination,
  ].join("|");
}

function buildParsedEntry({
  storedFields,
  originEndpoint,
  destinationEndpoint,
  legacyOrigin,
  legacyDestination,
  sameCity,
  waypoints,
  geocoderProvider,
}: {
  storedFields: NonNullable<ReturnType<typeof parseStoredAnalysisFields>>;
  originEndpoint: RouteEndpointSelection | null;
  destinationEndpoint: RouteEndpointSelection | null;
  legacyOrigin: LocationSuggestion | null;
  legacyDestination: LocationSuggestion | null;
  sameCity: boolean;
  waypoints: LocationSuggestion[];
  geocoderProvider: string;
}): GuestTripHistoryEntry {
  const requiresCityConfirmation = !originEndpoint || !destinationEndpoint;
  const fingerprintInput: FingerprintInput = {
    originEndpoint,
    destinationEndpoint,
    legacyOrigin,
    legacyDestination,
    sameCity,
    waypoints,
  };

  return {
    version: HISTORY_VERSION,
    ...storedFields,
    ...fingerprintInput,
    fingerprint: createGuestTripFingerprint(fingerprintInput),
    requiresCityConfirmation,
    geocoderProvider,
  };
}

function parseVersionTwoEntry(value: Record<string, unknown>) {
  const storedFields = parseStoredAnalysisFields(value);
  const originEndpoint = parseEndpoint(value.originEndpoint);
  const destinationEndpoint = parseEndpoint(value.destinationEndpoint);
  const legacyOrigin = parseLegacyLocation(value.legacyOrigin);
  const legacyDestination = parseLegacyLocation(value.legacyDestination);
  const hasStructuredEndpoints = Boolean(originEndpoint && destinationEndpoint);
  const hasLegacyEndpoints = Boolean(legacyOrigin && legacyDestination);
  const geocoderProvider = boundedString(value.geocoderProvider, 80);

  if (
    !storedFields ||
    typeof value.sameCity !== "boolean" ||
    !geocoderProvider ||
    hasStructuredEndpoints === hasLegacyEndpoints
  ) {
    return null;
  }

  if (
    hasStructuredEndpoints &&
    value.sameCity &&
    !citiesAreEquivalent(originEndpoint!.city, destinationEndpoint!.city)
  ) {
    return null;
  }

  return buildParsedEntry({
    storedFields,
    originEndpoint: hasStructuredEndpoints ? originEndpoint : null,
    destinationEndpoint: hasStructuredEndpoints ? destinationEndpoint : null,
    legacyOrigin: hasLegacyEndpoints ? legacyOrigin : null,
    legacyDestination: hasLegacyEndpoints ? legacyDestination : null,
    sameCity: value.sameCity,
    waypoints: parseWaypoints(value.waypoints),
    geocoderProvider,
  });
}

function parseVersionOneEntry(value: Record<string, unknown>) {
  const storedFields = parseStoredAnalysisFields(value);
  const legacyOrigin = parseLegacyLocation(value.origin);
  const legacyDestination = parseLegacyLocation(value.destination);

  if (!storedFields || !legacyOrigin || !legacyDestination) {
    return null;
  }

  return buildParsedEntry({
    storedFields,
    originEndpoint: null,
    destinationEndpoint: null,
    legacyOrigin,
    legacyDestination,
    sameCity: false,
    waypoints: parseWaypoints(value.waypoints),
    geocoderProvider: LEGACY_GEOCODER_PROVIDER,
  });
}

export function parseGuestTripHistoryEntry(value: unknown): GuestTripHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.version === HISTORY_VERSION) {
    return parseVersionTwoEntry(value);
  }

  if (value.version === LEGACY_HISTORY_VERSION) {
    return parseVersionOneEntry(value);
  }

  return null;
}

export function normalizeGuestTripHistory(
  entries: unknown[],
  limit = GUEST_TRIP_HISTORY_LIMIT,
) {
  const parsedEntries = entries
    .map(parseGuestTripHistoryEntry)
    .filter((entry): entry is GuestTripHistoryEntry => entry !== null)
    .sort((left, right) => Date.parse(right.analyzedAt) - Date.parse(left.analyzedAt));
  const seenFingerprints = new Set<string>();
  const seenIds = new Set<string>();

  return parsedEntries
    .filter((entry) => {
      if (seenFingerprints.has(entry.fingerprint) || seenIds.has(entry.id)) {
        return false;
      }

      seenFingerprints.add(entry.fingerprint);
      seenIds.add(entry.id);
      return true;
    })
    .slice(0, Math.max(0, limit));
}

export function mergeGuestTripHistory(
  entries: GuestTripHistoryEntry[],
  nextEntry: GuestTripHistoryEntry,
  limit = GUEST_TRIP_HISTORY_LIMIT,
) {
  return normalizeGuestTripHistory([nextEntry, ...entries], limit);
}

export function serializeGuestTripHistory(entries: GuestTripHistoryEntry[]) {
  const envelope: HistoryEnvelope = {
    version: HISTORY_VERSION,
    entries: normalizeGuestTripHistory(entries),
  };

  return JSON.stringify(envelope);
}

export function deserializeGuestTripHistory(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      !isRecord(parsed) ||
      ![HISTORY_VERSION, LEGACY_HISTORY_VERSION].includes(
        parsed.version as typeof HISTORY_VERSION,
      ) ||
      !Array.isArray(parsed.entries)
    ) {
      return [];
    }

    return normalizeGuestTripHistory(parsed.entries);
  } catch {
    return [];
  }
}

function createHistoryId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGuestTripHistoryEntry(
  entry: NewGuestTripHistoryEntry,
  options: { id?: string; analyzedAt?: Date } = {},
): GuestTripHistoryEntry {
  const originEndpoint = parseEndpoint(entry.originEndpoint);
  const destinationEndpoint = parseEndpoint(entry.destinationEndpoint);

  if (!originEndpoint || !destinationEndpoint) {
    throw new Error("Structured route endpoints are required for new trip history entries.");
  }

  const candidate = {
    ...entry,
    version: HISTORY_VERSION,
    id: options.id ?? createHistoryId(),
    analyzedAt: (options.analyzedAt ?? new Date()).toISOString(),
    originEndpoint,
    destinationEndpoint,
    legacyOrigin: null,
    legacyDestination: null,
    requiresCityConfirmation: false,
  };
  const parsed = parseGuestTripHistoryEntry(candidate);

  if (!parsed || parsed.requiresCityConfirmation) {
    throw new Error("The trip history entry is invalid.");
  }

  return parsed;
}

export function getGuestTripLocationLabel(
  entry: GuestTripHistoryEntry,
  endpoint: "origin" | "destination",
) {
  if (endpoint === "origin") {
    return entry.originEndpoint?.effectiveDisplayName ?? entry.legacyOrigin?.label ?? "Starting location";
  }

  return (
    entry.destinationEndpoint?.effectiveDisplayName ??
    entry.legacyDestination?.label ??
    "Destination"
  );
}

export function guestTripUsesCityFallback(
  entry: GuestTripHistoryEntry,
  endpoint: "origin" | "destination",
) {
  return endpoint === "origin"
    ? Boolean(entry.originEndpoint?.usesCityFallback)
    : Boolean(entry.destinationEndpoint?.usesCityFallback);
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser storage request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Browser storage transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Browser storage transaction was aborted."));
  });
}

function openHistoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        database.createObjectStore(HISTORY_STORE_NAME, { keyPath: "id" });
      }
      // Version 2 changes only the validated record shape. Existing records stay in
      // the store and are normalized transactionally after the first successful read.
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open browser storage."));
    request.onblocked = () => reject(new Error("Browser storage is blocked by another tab."));
  });
}

async function readIndexedHistory() {
  const database = await openHistoryDatabase();

  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readonly");
    const completed = transactionComplete(transaction);
    const rawEntries = await requestResult(transaction.objectStore(HISTORY_STORE_NAME).getAll());
    await completed;
    const entries = normalizeGuestTripHistory(rawEntries);
    const needsMigration =
      rawEntries.length !== entries.length ||
      rawEntries.some((entry) => !isRecord(entry) || entry.version !== HISTORY_VERSION);

    return { entries, needsMigration };
  } finally {
    database.close();
  }
}

async function replaceIndexedHistory(entries: GuestTripHistoryEntry[]) {
  const database = await openHistoryDatabase();

  try {
    const transaction = database.transaction(HISTORY_STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    store.clear();
    normalizeGuestTripHistory(entries).forEach((entry) => store.put(entry));
    await completed;
  } finally {
    database.close();
  }
}

function readLocalHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  const entries: GuestTripHistoryEntry[] = [];

  for (const key of [LOCAL_STORAGE_KEY, LEGACY_LOCAL_STORAGE_KEY]) {
    try {
      entries.push(...deserializeGuestTripHistory(window.localStorage.getItem(key)));
    } catch {
      // A blocked key must not prevent reading the other compatibility key.
    }
  }

  return normalizeGuestTripHistory(entries);
}

function replaceLocalHistory(entries: GuestTripHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, serializeGuestTripHistory(entries));
  window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
}

function clearLocalHistory() {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of [LOCAL_STORAGE_KEY, LEGACY_LOCAL_STORAGE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // A blocked localStorage should not make IndexedDB history unusable.
    }
  }
}

function notifyHistoryChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT));
  }
}

export async function listGuestTrips() {
  const localEntries = readLocalHistory();

  try {
    const indexedResult = await readIndexedHistory();
    const mergedEntries = normalizeGuestTripHistory([
      ...indexedResult.entries,
      ...localEntries,
    ]);

    if (indexedResult.needsMigration || localEntries.length > 0) {
      try {
        await replaceIndexedHistory(mergedEntries);
        clearLocalHistory();
      } catch {
        // Return the successfully parsed records and leave the old source intact for retry.
      }
    }

    return mergedEntries;
  } catch {
    return localEntries;
  }
}

export async function saveGuestTrip(entry: GuestTripHistoryEntry) {
  const parsedEntry = parseGuestTripHistoryEntry(entry);

  if (!parsedEntry) {
    throw new Error("The trip history entry is invalid.");
  }

  let nextEntries: GuestTripHistoryEntry[];

  try {
    const indexedResult = await readIndexedHistory();
    nextEntries = mergeGuestTripHistory(
      normalizeGuestTripHistory([...indexedResult.entries, ...readLocalHistory()]),
      parsedEntry,
    );
    await replaceIndexedHistory(nextEntries);
    clearLocalHistory();
  } catch {
    nextEntries = mergeGuestTripHistory(readLocalHistory(), parsedEntry);
    replaceLocalHistory(nextEntries);
  }

  notifyHistoryChanged();
  return nextEntries;
}

export async function deleteGuestTrip(id: string) {
  const currentEntries = await listGuestTrips();
  const nextEntries = currentEntries.filter((entry) => entry.id !== id);

  try {
    await replaceIndexedHistory(nextEntries);
    clearLocalHistory();
  } catch {
    replaceLocalHistory(nextEntries);
  }

  notifyHistoryChanged();
  return nextEntries;
}

export async function clearGuestTrips() {
  try {
    await replaceIndexedHistory([]);
  } catch {
    // Clearing the active local fallback still honors the user's request when
    // IndexedDB is unavailable in this browser session.
  }

  clearLocalHistory();
  notifyHistoryChanged();
}

export function subscribeToGuestHistory(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if ([LOCAL_STORAGE_KEY, LEGACY_LOCAL_STORAGE_KEY].includes(event.key ?? "")) {
      listener();
    }
  };

  window.addEventListener(HISTORY_CHANGED_EVENT, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(HISTORY_CHANGED_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function removeRestoreValues(storage: Storage) {
  for (const key of [RESTORE_STORAGE_KEY, LEGACY_RESTORE_STORAGE_KEY]) {
    try {
      storage.removeItem(key);
    } catch {
      // Continue clearing the remaining compatibility key.
    }
  }
}

function consumeRestoreValue(storage: Storage) {
  let restoredEntry: GuestTripHistoryEntry | null = null;

  for (const key of [RESTORE_STORAGE_KEY, LEGACY_RESTORE_STORAGE_KEY]) {
    try {
      const serializedEntry = storage.getItem(key);
      storage.removeItem(key);

      if (!serializedEntry || restoredEntry) {
        continue;
      }

      restoredEntry = parseGuestTripHistoryEntry(
        JSON.parse(serializedEntry) as unknown,
      );
    } catch {
      // Try the remaining key so a malformed legacy payload cannot block v2.
    }
  }

  return restoredEntry;
}

export function queueGuestTripRestore(entry: GuestTripHistoryEntry) {
  if (typeof window === "undefined") {
    return false;
  }

  const parsedEntry = parseGuestTripHistoryEntry(entry);

  if (!parsedEntry) {
    return false;
  }

  const serializedEntry = JSON.stringify(parsedEntry);

  try {
    removeRestoreValues(window.sessionStorage);
    removeRestoreValues(window.localStorage);
    window.sessionStorage.setItem(RESTORE_STORAGE_KEY, serializedEntry);
    return true;
  } catch {
    try {
      window.localStorage.setItem(RESTORE_STORAGE_KEY, serializedEntry);
      return true;
    } catch {
      return false;
    }
  }
}

export function consumeGuestTripRestore() {
  if (typeof window === "undefined") {
    return null;
  }

  let sessionEntry: GuestTripHistoryEntry | null = null;
  let localEntry: GuestTripHistoryEntry | null = null;

  try {
    sessionEntry = consumeRestoreValue(window.sessionStorage);
  } catch {
    // Fall through to localStorage when sessionStorage is unavailable.
  }

  try {
    localEntry = consumeRestoreValue(window.localStorage);
  } catch {
    // Return the session value, if any, when localStorage is unavailable.
  }

  return sessionEntry ?? localEntry;
}
