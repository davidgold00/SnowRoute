import type {
  ForecastConfidence,
  LocationSuggestion,
  RiskLabel,
  TripDecisionLevel,
} from "@/lib/types";

export const GUEST_TRIP_HISTORY_LIMIT = 20;

const HISTORY_VERSION = 1 as const;
const DATABASE_NAME = "snowroute-local-data";
const DATABASE_VERSION = 1;
const HISTORY_STORE_NAME = "trip-history";
const LOCAL_STORAGE_KEY = "snowroute.guestTripHistory.v1";
const RESTORE_STORAGE_KEY = "snowroute.tripHistoryRestore.v1";
const HISTORY_CHANGED_EVENT = "snowroute:guest-history-changed";

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

export type GuestTripHistoryEntry = {
  version: typeof HISTORY_VERSION;
  id: string;
  fingerprint: string;
  analyzedAt: string;
  origin: LocationSuggestion;
  destination: LocationSuggestion;
  waypoints: LocationSuggestion[];
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

export type NewGuestTripHistoryEntry = Omit<
  GuestTripHistoryEntry,
  "version" | "id" | "fingerprint" | "analyzedAt"
>;

type HistoryEnvelope = {
  version: typeof HISTORY_VERSION;
  entries: GuestTripHistoryEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function optionalStringOrNull(value: unknown) {
  return typeof value === "string" ? value.slice(0, 240) : null;
}

function parseLocation(value: unknown): LocationSuggestion | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    !isFiniteCoordinate(value.lat, -90, 90) ||
    !isFiniteCoordinate(value.lon, -180, 180) ||
    !PLACE_TYPES.includes(value.placeType as LocationSuggestion["placeType"])
  ) {
    return null;
  }

  const label = value.label.slice(0, 240);
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
  const providerConfidence =
    typeof value.providerConfidence === "number" &&
    Number.isFinite(value.providerConfidence) &&
    value.providerConfidence >= 0 &&
    value.providerConfidence <= 1
      ? value.providerConfidence
      : null;

  return {
    id: value.id.slice(0, 240),
    providerId: optionalStringOrNull(value.providerId),
    label,
    formattedAddress:
      typeof value.formattedAddress === "string"
        ? value.formattedAddress.slice(0, 240)
        : label,
    primaryLabel:
      typeof value.primaryLabel === "string"
        ? value.primaryLabel.slice(0, 180)
        : label.split(",")[0]?.trim() || label,
    lat: value.lat,
    lon: value.lon,
    locality: optionalStringOrNull(value.locality),
    country: optionalStringOrNull(value.country),
    countryCode: optionalStringOrNull(value.countryCode),
    region: optionalStringOrNull(value.region),
    postalCode: optionalStringOrNull(value.postalCode),
    detail: optionalStringOrNull(value.detail),
    placeType: value.placeType as LocationSuggestion["placeType"],
    locationType,
    precision,
    isApproximate:
      typeof value.isApproximate === "boolean"
        ? value.isApproximate
        : ["postal", "city", "region", "unknown"].includes(precision),
    providerConfidence,
  };
}

function createLocationFingerprint(location: LocationSuggestion) {
  return `${location.lat.toFixed(5)},${location.lon.toFixed(5)}`;
}

export function createGuestTripFingerprint(
  origin: LocationSuggestion,
  destination: LocationSuggestion,
  waypoints: LocationSuggestion[] = [],
) {
  return [origin, ...waypoints, destination].map(createLocationFingerprint).join("|");
}

export function parseGuestTripHistoryEntry(value: unknown): GuestTripHistoryEntry | null {
  if (!isRecord(value) || value.version !== HISTORY_VERSION) {
    return null;
  }

  const origin = parseLocation(value.origin);
  const destination = parseLocation(value.destination);
  const waypoints = (Array.isArray(value.waypoints)
    ? value.waypoints.map(parseLocation).filter((item): item is LocationSuggestion => item !== null)
    : []).slice(0, 2);
  const analyzedAtMs = typeof value.analyzedAt === "string" ? Date.parse(value.analyzedAt) : NaN;

  if (
    !origin ||
    !destination ||
    typeof value.id !== "string" ||
    !value.id ||
    !Number.isFinite(analyzedAtMs) ||
    typeof value.departureTimeLocal !== "string" ||
    typeof value.departureTimeUtc !== "string" ||
    !Number.isFinite(Date.parse(value.departureTimeUtc)) ||
    typeof value.timeZone !== "string" ||
    !DECISIONS.includes(value.decision as TripDecisionLevel) ||
    typeof value.decisionLabel !== "string" ||
    typeof value.decisionSummary !== "string" ||
    !RISK_LABELS.includes(value.overallRisk as RiskLabel) ||
    !CONFIDENCE_LEVELS.includes(value.confidence as ForecastConfidence) ||
    !RISK_LABELS.includes(value.worstSegmentRisk as RiskLabel) ||
    typeof value.worstSegmentLocationLabel !== "string" ||
    typeof value.worstSegmentArrivalTime !== "string" ||
    typeof value.riskModelVersion !== "string" ||
    typeof value.distanceKm !== "number" ||
    !Number.isFinite(value.distanceKm) ||
    value.distanceKm < 0 ||
    typeof value.durationMinutes !== "number" ||
    !Number.isFinite(value.durationMinutes) ||
    value.durationMinutes < 0
  ) {
    return null;
  }

  const fingerprint = createGuestTripFingerprint(origin, destination, waypoints);

  return {
    version: HISTORY_VERSION,
    id: value.id.slice(0, 180),
    fingerprint,
    analyzedAt: new Date(analyzedAtMs).toISOString(),
    origin,
    destination,
    waypoints,
    departureTimeLocal: value.departureTimeLocal.slice(0, 32),
    departureTimeUtc: new Date(value.departureTimeUtc).toISOString(),
    timeZone: value.timeZone.slice(0, 120),
    decision: value.decision as TripDecisionLevel,
    decisionLabel: value.decisionLabel.slice(0, 120),
    decisionSummary: value.decisionSummary.slice(0, 600),
    overallRisk: value.overallRisk as RiskLabel,
    confidence: value.confidence as ForecastConfidence,
    mainHazards: Array.isArray(value.mainHazards)
      ? value.mainHazards
          .filter((item): item is string => typeof item === "string")
          .slice(0, 5)
          .map((item) => item.slice(0, 160))
      : [],
    worstSegmentRisk: value.worstSegmentRisk as RiskLabel,
    worstSegmentLocationLabel: value.worstSegmentLocationLabel.slice(0, 240),
    worstSegmentArrivalTime: value.worstSegmentArrivalTime.slice(0, 160),
    riskModelVersion: value.riskModelVersion.slice(0, 80),
    distanceKm: value.distanceKm,
    durationMinutes: value.durationMinutes,
  };
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

  return parsedEntries.filter((entry) => {
    if (seenFingerprints.has(entry.fingerprint) || seenIds.has(entry.id)) {
      return false;
    }

    seenFingerprints.add(entry.fingerprint);
    seenIds.add(entry.id);
    return true;
  }).slice(0, Math.max(0, limit));
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

    if (!isRecord(parsed) || parsed.version !== HISTORY_VERSION || !Array.isArray(parsed.entries)) {
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
  const analyzedAt = options.analyzedAt ?? new Date();

  return {
    ...entry,
    version: HISTORY_VERSION,
    id: options.id ?? createHistoryId(),
    fingerprint: createGuestTripFingerprint(entry.origin, entry.destination, entry.waypoints),
    analyzedAt: analyzedAt.toISOString(),
  };
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
    transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage transaction was aborted."));
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
    const entries = await requestResult(transaction.objectStore(HISTORY_STORE_NAME).getAll());
    await completed;
    return normalizeGuestTripHistory(entries);
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

  try {
    return deserializeGuestTripHistory(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch {
    return [];
  }
}

function replaceLocalHistory(entries: GuestTripHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, serializeGuestTripHistory(entries));
}

function clearLocalHistory() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
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
  try {
    const indexedEntries = await readIndexedHistory();
    const localEntries = readLocalHistory();
    const mergedEntries = normalizeGuestTripHistory([...indexedEntries, ...localEntries]);

    if (localEntries.length > 0) {
      await replaceIndexedHistory(mergedEntries);
      clearLocalHistory();
    }

    return mergedEntries;
  } catch {
    return readLocalHistory();
  }
}

export async function saveGuestTrip(entry: GuestTripHistoryEntry) {
  const parsedEntry = parseGuestTripHistoryEntry(entry);

  if (!parsedEntry) {
    throw new Error("The trip history entry is invalid.");
  }

  let nextEntries: GuestTripHistoryEntry[];

  try {
    const indexedEntries = await readIndexedHistory();
    nextEntries = mergeGuestTripHistory(
      normalizeGuestTripHistory([...indexedEntries, ...readLocalHistory()]),
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
    clearLocalHistory();
  } catch {
    clearLocalHistory();
  }

  notifyHistoryChanged();
}

export function subscribeToGuestHistory(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY) {
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

export function queueGuestTripRestore(entry: GuestTripHistoryEntry) {
  if (typeof window === "undefined") {
    return false;
  }

  const serializedEntry = JSON.stringify(entry);

  try {
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

  let serializedEntry: string | null = null;

  try {
    serializedEntry = window.sessionStorage.getItem(RESTORE_STORAGE_KEY);
    window.sessionStorage.removeItem(RESTORE_STORAGE_KEY);
  } catch {
    // Fall through to localStorage when sessionStorage is unavailable.
  }

  try {
    serializedEntry ??= window.localStorage.getItem(RESTORE_STORAGE_KEY);
    window.localStorage.removeItem(RESTORE_STORAGE_KEY);
  } catch {
    // Return null below if neither browser storage mechanism is available.
  }

  if (!serializedEntry) {
    return null;
  }

  try {
    return parseGuestTripHistoryEntry(JSON.parse(serializedEntry) as unknown);
  } catch {
    return null;
  }
}
