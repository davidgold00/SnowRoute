import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function buildHourlyDeparturesForTravelDay({
  departureTimeUtc,
  clientTimeZone,
  nowUtcMs = Date.now(),
}: {
  departureTimeUtc: string;
  clientTimeZone: string;
  nowUtcMs?: number;
}) {
  const selectedDeparture = new Date(departureTimeUtc);
  const travelDate = formatInTimeZone(selectedDeparture, clientTimeZone, "yyyy-MM-dd");
  const selectedHour = Number(formatInTimeZone(selectedDeparture, clientTimeZone, "H"));
  const selectedMinute = Number(formatInTimeZone(selectedDeparture, clientTimeZone, "m"));

  const candidates = Array.from({ length: 24 }, (_, hour) => {
    const localDateTime = `${travelDate}T${String(hour).padStart(2, "0")}:${String(
      selectedMinute,
    ).padStart(2, "0")}:00`;
    const isSelectedHour = hour === selectedHour;
    const departureDate = isSelectedHour
      ? selectedDeparture
      : fromZonedTime(localDateTime, clientTimeZone);
    const resolvedHour = Number(formatInTimeZone(departureDate, clientTimeZone, "H"));

    return {
      hour,
      departureTimeUtc: departureDate.toISOString(),
      departureTimeDisplay: formatInTimeZone(departureDate, clientTimeZone, "h:mm a"),
      hourLabel: formatInTimeZone(departureDate, clientTimeZone, "h:mmaaa"),
      isSelectedHour,
      isValidLocalHour: isSelectedHour || resolvedHour === hour,
    };
  }).filter((departure) => {
    const candidateTime = new Date(departure.departureTimeUtc).getTime();
    return departure.isValidLocalHour && (departure.isSelectedHour || candidateTime >= nowUtcMs);
  });
  const seenUtcTimes = new Set<string>();

  return candidates.flatMap((candidate) => {
    if (seenUtcTimes.has(candidate.departureTimeUtc)) {
      return [];
    }

    seenUtcTimes.add(candidate.departureTimeUtc);
    return [{
      hour: candidate.hour,
      departureTimeUtc: candidate.departureTimeUtc,
      departureTimeDisplay: candidate.departureTimeDisplay,
      hourLabel: candidate.hourLabel,
      isSelectedHour: candidate.isSelectedHour,
    }];
  });
}
