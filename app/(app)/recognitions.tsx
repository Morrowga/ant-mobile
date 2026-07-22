import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { Recognition } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Card, EmptyText, Screen, Subtitle } from "@/components/ui";

export default function Recognitions() {
  const kudos = useQuery({
    queryKey: ["recognitions", "me"],
    queryFn: async () => (await api.get<Recognition[]>("/recognitions/me")).data,
  });

  return (
    <Screen>
      <Subtitle>Kudos your managers have given you. These also feed your impact score.</Subtitle>
      <QueryBoundary query={kudos}>
        {(rows) => (
          <View className="mt-4">
            {rows.length === 0 && <EmptyText>No kudos yet — they'll show up here when they land.</EmptyText>}
            {rows.map((recognition) => (
              <Card key={recognition.id} className="mb-2">
                <Text className="font-sans text-[14px] leading-5 text-ink">🏆  {recognition.reason}</Text>
                <Text className="mt-1 font-sans text-xs text-faint">
                  {new Date(recognition.created_at).toLocaleDateString("en", { month: "long", day: "numeric" })}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}
