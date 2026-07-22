import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { AttendanceSession } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, Screen } from "@/components/ui";

export default function AttendanceHistory() {
  const history = useQuery({
    queryKey: ["attendance", "history"],
    queryFn: async () => (await api.get<AttendanceSession[]>("/attendance/me/history")).data,
  });

  return (
    <Screen>
      <QueryBoundary query={history}>
        {(rows) => (
          <View>
            {rows.length === 0 && <EmptyText>No attendance sessions yet.</EmptyText>}
            {rows.map((session) => {
              const checkIn = new Date(session.check_in_at);
              const checkOut = session.check_out_at ? new Date(session.check_out_at) : null;
              const hours = checkOut ? ((checkOut.getTime() - checkIn.getTime()) / 3_600_000).toFixed(1) : null;
              return (
                <Card key={session.id} className="mb-2 flex-row items-center justify-between py-3">
                  <View>
                    <Text className="font-sansmed text-[14px] text-ink">
                      {checkIn.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                    </Text>
                    <Text className="font-sans text-xs text-faint">
                      {checkIn.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      {" → "}
                      {checkOut ? checkOut.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) : "…"}
                    </Text>
                  </View>
                  {hours ? <Badge label={`${hours}h`} /> : <Badge label="open" tone="good" />}
                </Card>
              );
            })}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}
