/**
 * Language — the ONLY language control an employee has on mobile, mirroring
 * the portal exactly. No 5-language picker: the display language is
 * DECIDED by the company (an Owner/Manager, via the dashboard). This is a
 * binary toggle: switch to English, or switch back to whatever the
 * company assigned.
 *
 * Same localStorage-style "remember the assigned language" workaround as
 * the portal, since User.language is a single field with no separate
 * "originally assigned" column -- here using AsyncStorage instead of
 * localStorage since this is React Native.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { Me } from "@/lib/types";
import { Card, ErrorText, Row, Screen, Title } from "@/components/ui";

const ASSIGNED_LANGUAGE_KEY = "ants.assigned_language";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  hi: "Hindi",
};

export default function Language() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [assignedLanguage, setAssignedLanguage] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/me")).data,
  });

  useEffect(() => {
    AsyncStorage.getItem(ASSIGNED_LANGUAGE_KEY).then(setAssignedLanguage);
  }, []);

  useEffect(() => {
    if (me.data?.language && me.data.language !== "en" && !assignedLanguage) {
      AsyncStorage.setItem(ASSIGNED_LANGUAGE_KEY, me.data.language);
      setAssignedLanguage(me.data.language);
    }
  }, [me.data?.language, assignedLanguage]);

  const setLanguage = useMutation({
    mutationFn: (language: string) => api.patch("/me", { language }),
    onSuccess: (_res, language) => {
      void i18n.changeLanguage(language);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const isEnglish = me.data?.language === "en";

  return (
    <Screen>
      <Title>{t("features.language.title")}</Title>
      <Text className="mt-1 font-sans text-sm text-faint">{t("features.language.description")}</Text>

      <Card className="mt-4 py-3">
        <Row className="justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-sansmed text-[15px] text-ink">{t("features.language.useEnglish")}</Text>
            <Text className="mt-0.5 font-sans text-xs text-faint">
              {assignedLanguage
                ? t("features.language.toggleOffHint", { language: LANGUAGE_NAMES[assignedLanguage] ?? assignedLanguage })
                : t("features.language.toggleOffHintNoAssigned")}
            </Text>
          </View>
          <Switch
            value={isEnglish}
            disabled={setLanguage.isPending}
            onValueChange={(checked) => {
              if (checked) {
                setLanguage.mutate("en");
              } else {
                setLanguage.mutate(assignedLanguage ?? "en");
              }
            }}
          />
        </Row>
      </Card>

      {setLanguage.isError && <ErrorText>{t("features.language.error")}</ErrorText>}
    </Screen>
  );
}