import { describe, expect, it } from "vitest";

import { buildHourlyDeparturesForTravelDay } from "../lib/departure-candidates";

describe("analysis departure candidates", () => {
  it("preserves selected minutes and excludes earlier same-day candidates", () => {
    const options = buildHourlyDeparturesForTravelDay({
      departureTimeUtc: "2026-07-09T14:45:00.000Z",
      clientTimeZone: "America/Detroit",
      nowUtcMs: Date.parse("2026-07-09T12:30:00.000Z"),
    });

    expect(options[0].hour).toBe(8);
    expect(options.every((option) => option.departureTimeDisplay.includes(":45"))).toBe(true);
    expect(options.find((option) => option.isSelectedHour)).toMatchObject({
      hour: 10,
      departureTimeUtc: "2026-07-09T14:45:00.000Z",
      departureTimeDisplay: "10:45 AM",
    });
  });

  it("keeps all 24 hourly comparisons for a future travel day", () => {
    const options = buildHourlyDeparturesForTravelDay({
      departureTimeUtc: "2026-07-11T16:15:00.000Z",
      clientTimeZone: "UTC",
      nowUtcMs: Date.parse("2026-07-09T12:00:00.000Z"),
    });

    expect(options).toHaveLength(24);
    expect(options[0].departureTimeDisplay).toBe("12:15 AM");
    expect(options.at(-1)?.departureTimeDisplay).toBe("11:15 PM");
  });

  it("omits a nonexistent local hour across the spring daylight-saving transition", () => {
    const options = buildHourlyDeparturesForTravelDay({
      departureTimeUtc: "2026-03-08T16:15:00.000Z",
      clientTimeZone: "America/Detroit",
      nowUtcMs: Date.parse("2026-03-01T12:00:00.000Z"),
    });

    expect(options).toHaveLength(23);
    expect(options.some((option) => option.hour === 2)).toBe(false);
    expect(options.find((option) => option.isSelectedHour)?.departureTimeUtc).toBe(
      "2026-03-08T16:15:00.000Z",
    );
  });
});
