import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { startPresence, stopPresence } from "@/lib/presence";

export default function AppLayout() {
  const { ready, me } = useAuth();

  // Rule 9: heartbeat while the app is foregrounded, for push routing.
  useEffect(() => {
    if (me) startPresence();
    return () => stopPresence();
  }, [me]);

  if (ready && !me) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#f4f4f4" },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "SpaceGrotesk_600SemiBold", color: "#2b2a2a" },
        headerTintColor: "#a8672f",
        contentStyle: { backgroundColor: "#f4f4f4" },
        // Fixes the back button showing the literal "(tabs)" route-group
        // name as its label. headerBackTitle: "" alone wasn't respected on
        // this project's react-native-screens version -- adding the newer
        // headerBackButtonDisplayMode explicitly forces icon-only, which is
        // the more reliable modern way to achieve this.
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
      <Stack.Screen name="attendance-history" options={{ title: "Attendance history" }} />
      <Stack.Screen name="certificates" options={{ title: "Certificates" }} />
      <Stack.Screen name="recognitions" options={{ title: "Kudos" }} />
      <Stack.Screen name="feedback" options={{ title: "Feedback" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="notification-preferences" options={{ title: "Notification preferences" }} />
      <Stack.Screen name="change-password" options={{ title: "Change password" }} />
      {/* Modal popups -- these are answered from a push notification tap
          (or the Health tab banner), not part of normal tab navigation, so
          they present as an overlay sheet instead of a full page push. */}
      <Stack.Screen name="health-checkin/sleep" options={{ presentation: "modal", headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="health-checkin/mood-water" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="presence-check" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}