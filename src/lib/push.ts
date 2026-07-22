/**
 * FCM device registration (rule 8): register on login, re-register whenever
 * the token rotates (addPushTokenListener), unregister on sign-out.
 * Uses the NATIVE device push token because the backend talks to FCM directly.
 *
 * New: notification TAP handling -- this previously only set up HOW a
 * notification displays (setNotificationHandler), with no response
 * listener at all, so tapping an actual push banner (as opposed to a row
 * in the in-app Notifications list, which was already handled separately)
 * did nothing. presence_check just navigates to Today -- the blocking
 * dialog itself shows there based on a real polled status field
 * (pending_presence_check_id from GET /attendance/me/status), not from
 * this tap event, so it correctly persists across app restarts until
 * actually answered. Same pattern as the web portal.
 */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { api } from "./api-client";

let currentToken: string | null = null;
let rotationSub: Notifications.Subscription | null = null;
let responseSub: Notifications.Subscription | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function routeForType(type: string | undefined): string | null {
  switch (type) {
    case "sleep_checkin":
      return "/(app)/health-checkin/sleep";
    case "mood_water_checkin":
      return "/(app)/health-checkin/mood-water";
    case "presence_check":
      return "/(app)/(tabs)/today";
    case "overtime_request":
    case "overtime_decision":
      return "/(app)/overtime";
    case "desk_location_decision":
      return "/(app)/desk-location";
    default:
      return null;
  }
}

async function sendToken(token: string) {
  currentToken = token;
  await api.post("/notifications/register-device", { fcm_token: token, platform: "mobile" });
}

export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return; // simulators have no push token
  const { status } = await Notifications.getPermissionsAsync();
  const granted = status === "granted"
    ? true
    : (await Notifications.requestPermissionsAsync()).status === "granted";
  if (!granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const token = (await Notifications.getDevicePushTokenAsync()).data as string;
  await sendToken(token);

  // Rule 8, second half: FCM tokens rotate periodically — re-register on rotation.
  rotationSub?.remove();
  rotationSub = Notifications.addPushTokenListener((newToken) => {
    void sendToken(newToken.data as string);
  });

  // Tap handling -- fires whether the app was foregrounded, backgrounded,
  // or launched fresh from tapping the notification.
  responseSub?.remove();
  responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const type = typeof data?.type === "string" ? data.type : undefined;
    const destination = routeForType(type);
    if (destination) router.push(destination as never);
  });
}

export async function unregisterPush(): Promise<void> {
  rotationSub?.remove();
  rotationSub = null;
  responseSub?.remove();
  responseSub = null;
  if (currentToken) {
    await api.delete(`/notifications/device/${encodeURIComponent(currentToken)}`);
    currentToken = null;
  }
}