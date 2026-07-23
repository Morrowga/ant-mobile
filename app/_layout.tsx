import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts } from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider } from "@/lib/auth";
import "@/lib/i18n";
import { startQueueSync } from "@/lib/offline-queue";
import { queryClient } from "@/lib/query-client";
import "../global.css";

void SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => startQueueSync(), []); // rule 7: flush offline queue on start + reconnect

  // Tapping a health check-in notification deep-links to the matching
  // quick-answer screen, carrying prompt_id along so the answer gets tied
  // back to this specific reminder (see health.py's _mark_prompt_responded).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        { type?: string; prompt_id?: string } | undefined;
      if (data?.type === "sleep_checkin") {
        router.push({ pathname: "/(app)/health-checkin/sleep", params: { promptId: data.prompt_id } });
      } else if (data?.type === "mood_water_checkin") {
        router.push({ pathname: "/(app)/health-checkin/mood-water", params: { promptId: data.prompt_id } });
      } else if (data?.type === "presence_check") {
        router.push({ pathname: "/(app)/presence-check", params: { promptId: data.prompt_id } });
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}