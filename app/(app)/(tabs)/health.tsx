/**
 * Personal health — SELF-ONLY by design (rule 6). This screen renders only
 * the current user's own logs; no team view exists or is implied anywhere.
 */
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
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

const PROMPT_LABEL: Record<CheckinPrompt["type"], string> = {
  sleep_checkin: "Sleep check-in",
  mood_water_checkin: "Mood & water check-in",
};

const PROMPT_ROUTE: Record<CheckinPrompt["type"], string> = {
  sleep_checkin: "/(app)/health-checkin/sleep",
  mood_water_checkin: "/(app)/health-checkin/mood-water",
};

export default function Health() {
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
      <Title>Your health</Title>
      <Subtitle>Only you can see this. Your company only ever sees anonymous team averages — never your entries.</Subtitle>

      {/* This IS the primary content of this area now -- not a separate
          section alongside manual logging. Shows every currently
          unanswered reminder (could be zero, one, or several); tapping one
          opens its dialog (a modal-presented screen, see health-checkin/*
          and app/(app)/_layout.tsx's presentation: "modal"). Once
          answered, it disappears from this list on its own -- the
          disappearance IS the success confirmation, reinforced by a brief
          "Logged!" state inside each dialog before it closes. */}
      <SectionTitle>Reminders</SectionTitle>
      <QueryBoundary query={pending}>
        {(rows) => (
          <View className="gap-2">
            {rows.length === 0 && (
              <Card className="items-center py-6">
                <Text className="font-sans text-sm text-faint">All caught up — nothing waiting right now.</Text>
              </Card>
            )}
            {rows.map((p) => (
              <Pressable key={p.id} onPress={() => openPrompt(p)}>
                <Card className="border-copper/40 bg-[#f0e0cf]/40">
                  <Row className="justify-between">
                    <View>
                      <Text className="font-sansbold text-[14px] text-espresso">{PROMPT_LABEL[p.type]}</Text>
                      <Text className="mt-0.5 font-sans text-xs text-faint">Tap to answer now</Text>
                    </View>
                    <Badge label="unanswered" tone="warn" />
                  </Row>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </QueryBoundary>

      <SectionTitle>Today's check-ins</SectionTitle>
      <QueryBoundary query={todaysPrompts}>
        {(rows) => (
          <View className="gap-2">
            {rows.length === 0 && (
              <Text className="py-2 font-sans text-sm text-faint">
                No reminders sent yet today — they'll appear here once you check in.
              </Text>
            )}
            {rows.map((p) => (
              <Card key={p.id} className="flex-row items-center justify-between py-3">
                <View>
                  <Text className="font-sans text-[14px] text-ink">{PROMPT_LABEL[p.type]}</Text>
                  <Text className="mt-0.5 font-sans text-xs text-faint">
                    {new Date(p.sent_at).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
                <Badge label={p.responded_at ? "answered" : "unanswered"} tone={p.responded_at ? "good" : "warn"} />
              </Card>
            ))}
          </View>
        )}
      </QueryBoundary>

      <SectionTitle>This week</SectionTitle>
      <QueryBoundary query={dashboard}>
        {(data) => (
          <View className="gap-2">
            <Stat label="Average water / day" value={`${Math.round(sum(data.water) / 7)} ml`} />
            <Stat label="Average mood" value={data.mood.length ? (sum(data.mood) / data.mood.length).toFixed(1) + " / 5" : "—"} />
            <Stat label="Average sleep / day" value={data.sleep.length ? `${(sum(data.sleep) / 7).toFixed(1)} h` : "—"} />
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