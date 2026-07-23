import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { AttendanceSession } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, Screen } from "@/components/ui";

export default function AttendanceHistory() {
  const { t, i18n } = useTranslation();
  const history = useQuery({
    queryKey: ["attendance", "history"],
    queryFn: async () => (await api.get<AttendanceSession[]>("/attendance/me/history")).data,
  });

  return (
    <Screen>
      <QueryBoundary query={history}>
        {(rows) => (
          <View>
            {rows.length === 0 && <EmptyText>{t("features.attendanceHistory.empty")}</EmptyText>}
            {rows.map((session) => {
              const checkIn = new Date(session.check_in_at);
              const checkOut = session.check_out_at ? new Date(session.check_out_at) : null;
              const hours = checkOut ? ((checkOut.getTime() - checkIn.getTime()) / 3_600_000).toFixed(1) : null;
              return (
                <Card key={session.id} className="mb-2 flex-row items-center justify-between py-3">
                  <View>
                    <Text className="font-sansmed text-[14px] text-ink">
                      {checkIn.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}
                    </Text>
                    <Text className="font-sans text-xs text-faint">
                      {checkIn.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                      {" → "}
                      {checkOut ? checkOut.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) : "…"}
                    </Text>
                  </View>
                  {hours ? <Badge label={t("features.attendanceHistory.hoursValue", { value: hours })} /> : <Badge label={t("features.attendanceHistory.open")} tone="good" />}
                </Card>
              );
            })}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}