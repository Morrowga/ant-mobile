/** Mute non-critical categories. Categories in the backend's hardcoded
 *  NON-MUTABLE list render disabled + greyed out — always delivered. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { NotificationPreferences } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Card, Screen, Subtitle } from "@/components/ui";

const MUTABLE_SUGGESTIONS = ["kudos", "knowledge", "report_comment", "wellbeing", "general"];

export default function NotificationPreferencesScreen() {
  const qc = useQueryClient();
  const preferences = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => (await api.get<NotificationPreferences>("/notifications/preferences")).data,
  });
  const save = useMutation({
    mutationFn: (muted_categories: string[]) => api.patch("/notifications/preferences", { muted_categories }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
  });

  return (
    <Screen>
      <Subtitle>Attendance, overtime, payroll, leave and alert notifications are always delivered — those keep you paid and covered.</Subtitle>
      <QueryBoundary query={preferences}>
        {(prefs) => {
          const locked = prefs.non_mutable_categories ?? [];
          const muted = new Set(prefs.muted_categories ?? []);
          const categories = Array.from(new Set([...locked, ...MUTABLE_SUGGESTIONS, ...muted]));
          return (
            <View className="mt-4">
              {categories.map((category) => {
                const isLocked = locked.includes(category);
                const isOn = isLocked || !muted.has(category);
                return (
                  <Card key={category} className={`mb-2 flex-row items-center justify-between py-3 ${isLocked ? "opacity-50" : ""}`}>
                    <View className="flex-1 pr-3">
                      <Text className="font-sansmed text-[14px] capitalize text-ink">{category.replaceAll("_", " ")}</Text>
                      {isLocked && <Text className="font-sans text-xs text-faint">Always on</Text>}
                    </View>
                    <Switch
                      value={isOn}
                      disabled={isLocked || save.isPending}
                      onValueChange={(on) => {
                        const next = new Set(muted);
                        if (on) next.delete(category); else next.add(category);
                        save.mutate(Array.from(next));
                      }}
                      trackColor={{ true: "#bfa287", false: "#e4ddd6" }}
                      thumbColor="#6c4b36"
                    />
                  </Card>
                );
              })}
            </View>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}
