/**
 * Consent screens (rule 3): explicit, per-type consent recorded via
 * POST /consent BEFORE any permission prompt. The location card explains the
 * persistent Android notification (rule 2) up front — no silent tracking.
 */
import { router } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { requestLocationPermissions } from "@/lib/location";
import { registerForPush } from "@/lib/push";
import { Button, Card, ErrorText, Screen, Subtitle, Title } from "@/components/ui";

const CONSENTS = [
  {
    type: "location" as const,
    title: "Location while on the clock",
    body: "Your location is recorded ONLY between check-in and check-out, to confirm attendance. " +
      "While tracking is active your phone shows a persistent notification — that's an operating-system " +
      "requirement, and it means tracking is never silent. It stops the moment you check out.",
  },
  {
    type: "health" as const,
    title: "Personal health tracking",
    body: "Water, mood, breaks, steps, and sleep — visible to YOU only. Your manager and company can " +
      "never see your individual entries; teams only ever see anonymous averages of 3 or more people.",
  },
  {
    type: "notifications" as const,
    title: "Notifications",
    body: "Reminders to check in, submit your daily report, take breaks, and updates from your company.",
  },
];

export default function Consent() {
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
          setError("Background location isn't available in this preview build — attendance will still work while the app is open. Full background tracking requires the installed app.");
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
      <Title>Before you start</Title>
      <Subtitle>Each of these is your choice, recorded individually. You can work without any of them.</Subtitle>
      {CONSENTS.map((consent) => (
        <Card key={consent.type} className="mt-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 pr-3 font-sansbold text-[15px] text-ink">{consent.title}</Text>
            <Switch
              value={!!accepted[consent.type]}
              onValueChange={(value) => setAccepted((prev) => ({ ...prev, [consent.type]: value }))}
              trackColor={{ true: "#bfa287", false: "#e4ddd6" }}
              thumbColor="#6c4b36"
            />
          </View>
          <Text className="mt-2 font-sans text-[13px] leading-5 text-faint">{consent.body}</Text>
        </Card>
      ))}
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Save my choices" variant="dark" className="mt-6" loading={busy} onPress={submit} />
    </Screen>
  );
}
