/**
 * Background location (rules 1–3).
 * - The task ONLY runs between check-in and check-out: startTracking() is
 *   called right after a successful check-in, stopTracking() is called
 *   IMMEDIATELY on check-out (stopLocationUpdatesAsync — a hard stop, not a
 *   pause). The backend independently 409s any ping outside a session.
 * - Android requires a visible, persistent foreground-service notification
 *   while this runs — configured below and disclosed on the consent screen.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { api } from "./api-client";

export const LOCATION_TASK = "ants-attendance-location";

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations[locations.length - 1];
  if (!last) return;
  try {
    // Backend enforces rule 1 too: 409 outside an active session.
    await api.post("/attendance/ping", {
      lat: last.coords.latitude,
      lng: last.coords.longitude,
    });
  } catch {
    // Session over or offline — never crash the task; check-out stops it anyway.
  }
});

export async function requestLocationPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return { foreground: false, background: false };

  // Background permission genuinely cannot be requested inside plain Expo
  // Go -- it throws (not just "denied"), because Expo Go's shared binary
  // can't carry this app's custom Info.plist strings. Isolate it so that
  // failure never blocks foreground-only usage or crashes the consent flow.
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return { foreground: true, background: bg.status === "granted" };
  } catch {
    return { foreground: true, background: false };
  }
}

export async function getCurrentPosition() {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
}

export async function startTracking(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000, // one ping every ~5 minutes
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true, // iOS blue pill
    foregroundService: {
      // Rule 2: persistent, visible notification while tracking is active.
      notificationTitle: "Ants — on the clock",
      notificationBody: "Location is being recorded until you check out.",
      notificationColor: "#6c4b36",
    },
  });
  return true;
}

/** HARD stop, called immediately on check-out (rule 1). */
export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}
