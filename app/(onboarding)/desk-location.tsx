import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { getCurrentPosition } from "@/lib/location";
import { Button, Card, ErrorText, Screen, Subtitle, Title } from "@/components/ui";

/** One-time GPS pin of the usual work spot — POST /attendance/desk-location. */
export default function DeskLocation() {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pin = async () => {
    setBusy(true); setError(null);
    try {
      const position = await getCurrentPosition();
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      await api.post("/attendance/desk-location", point);
      setPinned(point);
    } catch (e) {
      setError(errorDetail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t("features.onboardingDeskLocation.title")}</Title>
      <Subtitle>{t("features.onboardingDeskLocation.subtitle")}</Subtitle>
      <Card className="mt-5 items-center py-8">
        {pinned ? (
          <>
            <Text className="font-display text-lg text-ink">{t("features.onboardingDeskLocation.pinned")}</Text>
            <Text className="mt-1 font-sans text-xs text-faint">
              {pinned.lat.toFixed(5)}, {pinned.lng.toFixed(5)}
            </Text>
          </>
        ) : (
          <Text className="font-sans text-sm text-faint">{t("features.onboardingDeskLocation.noPinYet")}</Text>
        )}
      </Card>
      {error && <ErrorText>{error}</ErrorText>}
      <Button label={pinned ? t("features.onboardingDeskLocation.repinHere") : t("features.onboardingDeskLocation.pinCurrentSpot")} className="mt-4" loading={busy} onPress={pin} />
      <Button
        label={pinned ? t("features.onboardingDeskLocation.continue") : t("features.onboardingDeskLocation.skipForNow")}
        variant={pinned ? "dark" : "ghost"}
        className="mt-2"
        onPress={() => router.push("/(onboarding)/checklist")}
      />
    </Screen>
  );
}