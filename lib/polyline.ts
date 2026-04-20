import type { Coordinate } from "@/lib/types";

function decodeValue(encoded: string, startIndex: number) {
  let result = 0;
  let shift = 0;
  let index = startIndex;

  while (index < encoded.length) {
    const byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;

    if (byte < 0x20) {
      const delta = result & 1 ? ~(result >> 1) : result >> 1;

      return { delta, nextIndex: index };
    }
  }

  throw new Error("Invalid encoded polyline.");
}

export function decodePolyline(encoded: string, precision = 5): Coordinate[] {
  if (!encoded) {
    return [];
  }

  const factor = 10 ** precision;
  const coordinates: Coordinate[] = [];
  let lat = 0;
  let lon = 0;
  let index = 0;

  while (index < encoded.length) {
    const latChunk = decodeValue(encoded, index);
    lat += latChunk.delta;
    index = latChunk.nextIndex;

    const lonChunk = decodeValue(encoded, index);
    lon += lonChunk.delta;
    index = lonChunk.nextIndex;

    coordinates.push({
      lat: lat / factor,
      lon: lon / factor,
    });
  }

  return coordinates;
}
