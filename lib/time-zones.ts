import type { LocationSuggestion } from "@/lib/types";

export const MAX_WAYPOINTS = 2;

export type TimeZoneOption = {
  value: string;
  label: string;
  region: string;
  keywords: string[];
};

export const TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  {
    value: "America/Toronto",
    label: "Toronto / Ottawa",
    region: "Eastern Time",
    keywords: [
      "toronto",
      "ottawa",
      "montreal",
      "quebec",
      "eastern",
      "ontario",
    ],
  },
  {
    value: "America/New_York",
    label: "New York / Boston",
    region: "Eastern Time",
    keywords: ["new york", "boston", "detroit", "miami", "eastern"],
  },
  {
    value: "America/Chicago",
    label: "Chicago / Winnipeg",
    region: "Central Time",
    keywords: [
      "chicago",
      "winnipeg",
      "minneapolis",
      "dallas",
      "houston",
      "manitoba",
      "central",
    ],
  },
  {
    value: "America/Denver",
    label: "Denver / Calgary",
    region: "Mountain Time",
    keywords: ["denver", "calgary", "edmonton", "alberta", "mountain", "salt lake"],
  },
  {
    value: "America/Edmonton",
    label: "Edmonton / Calgary",
    region: "Mountain Time",
    keywords: ["edmonton", "calgary", "alberta", "mountain"],
  },
  {
    value: "America/Winnipeg",
    label: "Winnipeg",
    region: "Central Time",
    keywords: ["winnipeg", "manitoba", "central"],
  },
  {
    value: "America/Phoenix",
    label: "Phoenix",
    region: "Mountain Time, no daylight saving",
    keywords: ["phoenix", "arizona", "tucson"],
  },
  {
    value: "America/Los_Angeles",
    label: "Los Angeles / Seattle",
    region: "Pacific Time",
    keywords: [
      "los angeles",
      "san francisco",
      "seattle",
      "british columbia",
      "pacific",
      "california",
    ],
  },
  {
    value: "America/Vancouver",
    label: "Vancouver",
    region: "Pacific Time",
    keywords: ["vancouver", "british columbia", "pacific"],
  },
  {
    value: "America/Anchorage",
    label: "Anchorage",
    region: "Alaska Time",
    keywords: ["anchorage", "alaska"],
  },
  {
    value: "Pacific/Honolulu",
    label: "Honolulu",
    region: "Hawaii Time",
    keywords: ["honolulu", "hawaii"],
  },
  {
    value: "America/Halifax",
    label: "Halifax",
    region: "Atlantic Time",
    keywords: ["halifax", "nova scotia", "new brunswick", "atlantic"],
  },
  {
    value: "America/St_Johns",
    label: "St. John's",
    region: "Newfoundland Time",
    keywords: ["st johns", "newfoundland", "labrador"],
  },
  {
    value: "UTC",
    label: "UTC",
    region: "Coordinated Universal Time",
    keywords: ["utc", "zulu", "universal"],
  },
];

const REGION_TIME_ZONE_MAP: Record<string, string> = {
  alabama: "America/Chicago",
  alaska: "America/Anchorage",
  alberta: "America/Edmonton",
  arizona: "America/Phoenix",
  arkansas: "America/Chicago",
  "british columbia": "America/Vancouver",
  california: "America/Los_Angeles",
  colorado: "America/Denver",
  connecticut: "America/New_York",
  delaware: "America/New_York",
  florida: "America/New_York",
  georgia: "America/New_York",
  hawaii: "Pacific/Honolulu",
  illinois: "America/Chicago",
  indiana: "America/Indiana/Indianapolis",
  iowa: "America/Chicago",
  kansas: "America/Chicago",
  kentucky: "America/New_York",
  louisiana: "America/Chicago",
  maine: "America/New_York",
  manitoba: "America/Winnipeg",
  maryland: "America/New_York",
  massachusetts: "America/New_York",
  michigan: "America/Detroit",
  minnesota: "America/Chicago",
  mississippi: "America/Chicago",
  missouri: "America/Chicago",
  montana: "America/Denver",
  nebraska: "America/Chicago",
  nevada: "America/Los_Angeles",
  "new brunswick": "America/Halifax",
  "new hampshire": "America/New_York",
  "new jersey": "America/New_York",
  "new mexico": "America/Denver",
  "new york": "America/New_York",
  newfoundland: "America/St_Johns",
  "north carolina": "America/New_York",
  "north dakota": "America/Chicago",
  "northwest territories": "America/Yellowknife",
  "nova scotia": "America/Halifax",
  nunavut: "America/Iqaluit",
  ohio: "America/New_York",
  oklahoma: "America/Chicago",
  ontario: "America/Toronto",
  oregon: "America/Los_Angeles",
  pennsylvania: "America/New_York",
  "prince edward island": "America/Halifax",
  quebec: "America/Toronto",
  saskatchewan: "America/Regina",
  "south carolina": "America/New_York",
  "south dakota": "America/Chicago",
  tennessee: "America/Chicago",
  texas: "America/Chicago",
  utah: "America/Denver",
  vermont: "America/New_York",
  virginia: "America/New_York",
  washington: "America/Los_Angeles",
  wisconsin: "America/Chicago",
  wyoming: "America/Denver",
  yukon: "America/Whitehorse",
};

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[.,]/g, "").trim();
}

export function canAddWaypoint(count: number, maxWaypoints = MAX_WAYPOINTS) {
  return count < maxWaypoints;
}

export function getBrowserTimeZone(
  detectedTimeZone?: string | null,
  fallbackTimeZone = "UTC",
) {
  const timeZone =
    detectedTimeZone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined);

  return timeZone && timeZone.trim().length > 0 ? timeZone : fallbackTimeZone;
}

export function getTimeZoneOption(value: string) {
  return (
    TIME_ZONE_OPTIONS.find((option) => option.value === value) ?? {
      value,
      label: value.replace(/_/g, " "),
      region: "Detected time zone",
      keywords: [value],
    }
  );
}

export function filterTimeZoneOptions(query: string, selectedValue?: string) {
  const normalizedQuery = normalizeSearchValue(query);
  const selectedOption = selectedValue ? getTimeZoneOption(selectedValue) : null;

  if (!normalizedQuery) {
    return selectedOption &&
      !TIME_ZONE_OPTIONS.some((option) => option.value === selectedOption.value)
      ? [selectedOption, ...TIME_ZONE_OPTIONS]
      : TIME_ZONE_OPTIONS;
  }

  const matches = TIME_ZONE_OPTIONS.filter((option) => {
    const haystack = [
      option.value,
      option.label,
      option.region,
      ...option.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  if (
    selectedOption &&
    selectedOption.value.toLowerCase().includes(normalizedQuery) &&
    !matches.some((option) => option.value === selectedOption.value)
  ) {
    return [selectedOption, ...matches];
  }

  return matches;
}

export function inferTimeZoneFromLocation(
  location: Pick<LocationSuggestion, "country" | "detail" | "label" | "lon" | "region">,
) {
  const region = normalizeSearchValue(location.region ?? "");
  const detail = normalizeSearchValue(location.detail ?? "");
  const label = normalizeSearchValue(location.label ?? "");

  for (const [regionName, timeZone] of Object.entries(REGION_TIME_ZONE_MAP)) {
    if (
      region === regionName ||
      detail.includes(regionName) ||
      label.includes(regionName)
    ) {
      return timeZone;
    }
  }

  if (location.country === "Canada" || location.country === "United States") {
    if (location.lon <= -130) {
      return location.country === "Canada" ? "America/Whitehorse" : "America/Anchorage";
    }

    if (location.lon <= -115) {
      return "America/Los_Angeles";
    }

    if (location.lon <= -102) {
      return "America/Denver";
    }

    if (location.lon <= -87) {
      return "America/Chicago";
    }

    if (location.lon <= -52) {
      return "America/New_York";
    }
  }

  return null;
}

export function shouldOfferOriginTimeZoneSwitch({
  currentTimeZone,
  manualOverride,
  originTimeZone,
}: {
  currentTimeZone: string;
  manualOverride: boolean;
  originTimeZone: string | null;
}) {
  return Boolean(
    originTimeZone &&
      originTimeZone !== currentTimeZone &&
      !manualOverride,
  );
}
