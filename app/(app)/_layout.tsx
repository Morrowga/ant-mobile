import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { useIsConnected } from "@/lib/connectivity";
import { startPresence, stopPresence } from "@/lib/presence";
import { ConnectionErrorScreen } from "@/components/connection-error-screen";

export default function AppLayout() {
  const { ready, me } = useAuth();
  const connected = useIsConnected();

  // Rule 9: heartbeat while the app is foregrounded, for push routing.
  useEffect(() => {
    if (me) startPresence();
    return () => stopPresence();
  }, [me]);

  if (ready && !me) return <Redirect href="/(auth)/login" />;

  // New: full-screen block whenever offline, ANYWHERE inside the
  // authenticated app -- not just a banner. Replaces the previous
  // OfflineBanner approach per explicit request: losing connection should
  // stop the person from continuing to look at (now-stale, unconfirmable)
  // screens, rather than letting them keep browsing cached content
  // underneath a small strip. Auto-clears the instant useIsConnected()
  // flips back to true.
  if (!connected) return <ConnectionErrorScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#f4f4f4" },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "SpaceGrotesk_600SemiBold", color: "#2b2a2a" },
        headerTintColor: "#a8672f",
        contentStyle: { backgroundColor: "#f4f4f4" },
        headerBackTitle: "",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="report/new" options={{ title: "New report" }} />
      <Stack.Screen name="report/[id]" options={{ title: "Report" }} />
      <Stack.Screen name="knowledge/[id]" options={{ title: "Post" }} />
      <Stack.Screen name="knowledge/new" options={{ title: "New post" }} />
      <Stack.Screen name="leave" options={{ title: "Leave" }} />
      <Stack.Screen name="overtime" options={{ title: "Overtime" }} />
      <Stack.Screen name="overtime/[id]" options={{ title: "Overtime detail" }} />
      <Stack.Screen name="desk-location" options={{ title: "Desk location" }} />
      <Stack.Screen name="language" options={{ title: "Language" }} />
      <Stack.Screen name="attendance-history" options={{ title: "Attendance history" }} />
      <Stack.Screen name="certificates" options={{ title: "Certificates" }} />
      <Stack.Screen name="recognitions" options={{ title: "Kudos" }} />
      <Stack.Screen name="feedback" options={{ title: "Feedback" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="notification-preferences" options={{ title: "Notification preferences" }} />
      <Stack.Screen name="change-password" options={{ title: "Change password" }} />
      <Stack.Screen name="health-checkin/sleep" options={{ presentation: "modal", headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="health-checkin/mood-water" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="presence-check" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}