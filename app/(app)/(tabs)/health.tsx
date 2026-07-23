/**
 * Personal health — SELF-ONLY by design (rule 6). This screen renders only
 * the current user's own logs; no team view exists or is implied anywhere.
 */
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { HealthDashboard } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, Row, Screen, SectionTitle, Subtitle, Title } from "@/components/ui";

interface CheckinPrompt {
  id: number;
  type: "sleep_checkin" | "mood_water_checkin";
  sent_at: string;
  responded_at: string | null;
}

/** labelKey resolves under features.health.promptTypes.* */
const PROMPT_LABEL_KEY: Record<CheckinPrompt["type"], string> = {
  sleep_checkin: "sleepCheckin",
  mood_water_checkin: "moodWaterCheckin",
};

const PROMPT_ROUTE: Record<CheckinPrompt["type"], string> = {
  sleep_checkin: "/(app)/health-checkin/sleep",
  mood_water_checkin: "/(app)/health-checkin/mood-water",
};

export default function Health() {
  const { t, i18n } = useTranslation();
  const dashboard = useQuery({
    queryKey: ["health", "dashboard"],
    queryFn: async () => (await api.get<HealthDashboard>("/health/me/dashboard")).data,
  });
  const pending = useQuery({
    queryKey: ["health", "prompts", "pending"],
    queryFn: async () => (await api.get<CheckinPrompt[]>("/health/prompts/pending")).data,
  });
  const todaysPrompts = useQuery({
    queryKey: ["health", "prompts", "today"],
    queryFn: async () => (await api.get<CheckinPrompt[]>("/health/prompts/today")).data,
  });

  function openPrompt(p: CheckinPrompt) {
    router.push({ pathname: PROMPT_ROUTE[p.type], params: { promptId: String(p.id) } });
  }

  return (
    <Screen>
      <Title>{t("features.health.pageTitle")}</Title>
      <Subtitle>{t("features.health.pageDescription")}</Subtitle>

      {/* This IS the primary content of this area now -- not a separate
          section alongside manual logging. Shows every currently
          unanswered reminder (could be zero, one, or several); tapping one
          opens its dialog (a modal-presented screen, see health-checkin/*
          and app/(app)/_layout.tsx's presentation: "modal"). Once
          answered, it disappears from this list on its own -- the
          disappearance IS the success confirmation, reinforced by a brief
          "Logged!" state inside each dialog before it closes. */}
      <SectionTitle>{t("features.health.reminders")}</SectionTitle>
      <QueryBoundary query={pending}>
        {(rows) => (
          <View className="gap-2">
            {rows.length === 0 && (
              <Card className="items-center py-6">
                <Text className="font-sans text-sm text-faint">{t("features.health.allCaughtUp")}</Text>
              </Card>
            )}
            {rows.map((p) => (
              <Pressable key={p.id} onPress={() => openPrompt(p)}>
                <Card className="border-copper/40 bg-[#f0e0cf]/40">
                  <Row className="justify-between">
                    <View>
                      <Text className="font-sansbold text-[14px] text-espresso">{t(`features.health.promptTypes.${PROMPT_LABEL_KEY[p.type]}`)}</Text>
                      <Text className="mt-0.5 font-sans text-xs text-faint">{t("features.health.tapToAnswer")}</Text>
                    </View>
                    <Badge label={t("features.health.unanswered")} tone="warn" />
                  </Row>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </QueryBoundary>

      <SectionTitle>{t("features.health.todaysCheckins")}</SectionTitle>
      <QueryBoundary query={todaysPrompts}>
        {(rows) => (
          <View className="gap-2">
            {rows.length === 0 && (
              <Text className="py-2 font-sans text-sm text-faint">
                {t("features.health.noRemindersSentYet")}
              </Text>
            )}
            {rows.map((p) => (
              <Card key={p.id} className="flex-row items-center justify-between py-3">
                <View>
                  <Text className="font-sans text-[14px] text-ink">{t(`features.health.promptTypes.${PROMPT_LABEL_KEY[p.type]}`)}</Text>
                  <Text className="mt-0.5 font-sans text-xs text-faint">
                    {new Date(p.sent_at).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
                <Badge label={p.responded_at ? t("features.health.answered") : t("features.health.unanswered")} tone={p.responded_at ? "good" : "warn"} />
              </Card>
            ))}
          </View>
        )}
      </QueryBoundary>

      <SectionTitle>{t("features.health.thisWeek")}</SectionTitle>
      <QueryBoundary query={dashboard}>
        {(data) => (
          <View className="gap-2">
            <Stat label={t("features.health.avgWaterPerDay")} value={t("features.health.mlValue", { value: Math.round(sum(data.water) / 7) })} />
            <Stat label={t("features.health.avgMood")} value={data.mood.length ? t("features.health.moodValue", { value: (sum(data.mood) / data.mood.length).toFixed(1) }) : "—"} />
            <Stat label={t("features.health.avgSleepPerDay")} value={data.sleep.length ? t("features.health.hoursValue", { value: (sum(data.sleep) / 7).toFixed(1) }) : "—"} />
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const sum = (rows: { value: number }[]) => rows.reduce((acc, row) => acc + row.value, 0);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-row items-center justify-between py-3">
      <Text className="font-sans text-[14px] text-faint">{label}</Text>
      <Text className="font-display text-[16px] text-ink">{value}</Text>
    </Card>
  );
}