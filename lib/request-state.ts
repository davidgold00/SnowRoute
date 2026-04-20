"use client";

export type ServerMessagePayload = {
  message?: string;
  retryAfterSeconds?: number;
};

export function readServerMessage(
  payload: unknown,
  fallbackMessage: string,
) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallbackMessage;
}
