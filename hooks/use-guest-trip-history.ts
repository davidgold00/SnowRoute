"use client";

import { useCallback, useEffect, useState } from "react";

import {
  clearGuestTrips,
  deleteGuestTrip,
  listGuestTrips,
  saveGuestTrip,
  subscribeToGuestHistory,
  type GuestTripHistoryEntry,
} from "@/lib/guest-trip-history";

export function useGuestTripHistory() {
  const [trips, setTrips] = useState<GuestTripHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTrips(await listGuestTrips());
      setError(null);
    } catch {
      setError("Recent trips are unavailable in this browser right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void listGuestTrips().then((storedTrips) => {
      if (isCurrent) {
        setTrips(storedTrips);
        setError(null);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isCurrent) {
        setError("Recent trips are unavailable in this browser right now.");
        setIsLoading(false);
      }
    });

    const unsubscribe = subscribeToGuestHistory(() => void refresh());

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [refresh]);

  const save = useCallback(async (entry: GuestTripHistoryEntry) => {
    try {
      setTrips(await saveGuestTrip(entry));
      setError(null);
    } catch {
      setError("This trip could not be saved on this device.");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setTrips((currentTrips) => currentTrips.filter((trip) => trip.id !== id));

    try {
      setTrips(await deleteGuestTrip(id));
      setError(null);
    } catch {
      setError("That trip could not be removed. Try again.");
      void refresh();
    }
  }, [refresh]);

  const clear = useCallback(async () => {
    const previousTrips = trips;
    setTrips([]);

    try {
      await clearGuestTrips();
      setError(null);
    } catch {
      setTrips(previousTrips);
      setError("Trip history could not be cleared. Try again.");
    }
  }, [trips]);

  return { trips, isLoading, error, refresh, save, remove, clear };
}
