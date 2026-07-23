import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { ChecklistItem } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, EmptyText, Screen, Subtitle, Title } from "@/components/ui";

export default function OnboardingChecklist() {
  const { t } = useTranslation();
  const { markOnboarded } = useAuth();
  const qc = useQueryClient();
  const checklist = useQuery({
    queryKey: ["onboarding", "me"],
    queryFn: async () => (await api.get<ChecklistItem[]>("/onboarding/me")).data,
  });
  const complete = useMutation({
    mutationFn: (id: number) => api.post(`/onboarding/me/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", "me"] }),
  });

  const finish = async () => {
    await markOnboarded();
    router.replace("/(app)/(tabs)/today");
  };

  return (
    <Screen>
      <Title>{t("features.onboardingChecklist.title")}</Title>
      <Subtitle>{t("features.onboardingChecklist.subtitle")}</Subtitle>
      <QueryBoundary query={checklist}>
        {(items) => (
          <View className="mt-4">
            {items.length === 0 && <EmptyText>{t("features.onboardingChecklist.empty")}</EmptyText>}
            {items.map((item) => (
              <Pressable key={item.id} disabled={item.completed} onPress={() => complete.mutate(item.id)}>
                <Card className="mb-2 flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className={`font-sansmed text-[15px] ${item.completed ? "text-faint line-through" : "text-ink"}`}>
                      {item.title}
                    </Text>
                    <Text className="mt-0.5 font-sans text-xs capitalize text-faint">{item.type}</Text>
                  </View>
                  <Badge label={item.completed ? t("features.onboardingChecklist.done") : item.required ? t("features.onboardingChecklist.required") : t("features.onboardingChecklist.optional")}
                    tone={item.completed ? "good" : item.required ? "warn" : "neutral"} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </QueryBoundary>
      <Button label={t("features.onboardingChecklist.takeMeToApp")} variant="dark" className="mt-4" onPress={finish} />
    </Screen>
  );
}