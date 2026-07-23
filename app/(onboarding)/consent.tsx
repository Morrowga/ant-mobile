/**
 * Consent screens (rule 3): explicit, per-type consent recorded via
 * POST /consent BEFORE any permission prompt. The location card explains the
 * persistent Android notification (rule 2) up front — no silent tracking.
 */
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { requestLocationPermissions } from "@/lib/location";
import { registerForPush } from "@/lib/push";
import { Button, Card, ErrorText, Screen, Subtitle, Title } from "@/components/ui";

/** titleKey/bodyKey resolve under features.consent.items.* */
const CONSENTS = [
  { type: "location" as const, titleKey: "locationTitle", bodyKey: "locationBody" },
  { type: "health" as const, titleKey: "healthTitle", bodyKey: "healthBody" },
  { type: "notifications" as const, titleKey: "notificationsTitle", bodyKey: "notificationsBody" },
];

export default function Consent() {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState<Record<string, boolean>>({ location: false, health: false, notifications: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      for (const consent of CONSENTS) {
        await api.post("/consent", { type: consent.type, accepted: !!accepted[consent.type] });
      }
      // Only after explicit consent do we touch OS permissions.
      if (accepted.location) {
        const result = await requestLocationPermissions();
        if (accepted.location && !result.background) {
          setError(t("features.consent.backgroundLocationUnavailable"));
        }
      }
      if (accepted.notifications) await registerForPush();
      router.push("/(onboarding)/desk-location");
    } catch (e) {
      setError(errorDetail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>{t("features.consent.title")}</Title>
      <Subtitle>{t("features.consent.subtitle")}</Subtitle>
      {CONSENTS.map((consent) => (
        <Card key={consent.type} className="mt-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 pr-3 font-sansbold text-[15px] text-ink">{t(`features.consent.items.${consent.titleKey}`)}</Text>
            <Switch
              value={!!accepted[consent.type]}
              onValueChange={(value) => setAccepted((prev) => ({ ...prev, [consent.type]: value }))}
              trackColor={{ true: "#bfa287", false: "#e4ddd6" }}
              thumbColor="#6c4b36"
            />
          </View>
          <Text className="mt-2 font-sans text-[13px] leading-5 text-faint">{t(`features.consent.items.${consent.bodyKey}`)}</Text>
        </Card>
      ))}
      {error && <ErrorText>{error}</ErrorText>}
      <Button label={t("features.consent.saveChoices")} variant="dark" className="mt-6" loading={busy} onPress={submit} />
    </Screen>
  );
}