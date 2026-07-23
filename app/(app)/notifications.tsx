import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { Notification } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, Row, Screen } from "@/components/ui";

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: async () => (await api.get<Notification[]>("/notifications/me")).data,
  });
  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  /** Desk-location decision notifications (approved/rejected) navigate to
   * the Desk Location screen on tap, so the employee can see the result
   * directly instead of just reading the notification text and having to
   * go find it themselves via Profile -> Desk location. Other
   * notification types just mark read, same as before. */
  const handlePress = (notification: Notification) => {
    if (!notification.read_at) markRead.mutate(notification.id);
    if (notification.extra_data?.type === "desk_location_decision") {
      router.push("/(app)/desk-location");
    }
  };

  return (
    <Screen>
      <Row className="justify-end">
        <Link href="/(app)/notification-preferences" className="font-sansmed text-[13px] text-copper">
          {t("features.notifications.preferences")}
        </Link>
      </Row>
      <QueryBoundary query={notifications}>
        {(rows) => (
          <View className="mt-2">
            {rows.length === 0 && <EmptyText>{t("features.notifications.empty")}</EmptyText>}
            {rows.map((notification) => (
              <Pressable key={notification.id} onPress={() => handlePress(notification)}>
                <Card className={`mb-2 ${notification.read_at ? "opacity-60" : ""}`}>
                  <Row className="justify-between">
                    <Text className="flex-1 pr-2 font-sansbold text-[14px] text-ink">{notification.title}</Text>
                    <Badge label={notification.category.replaceAll("_", " ")} />
                  </Row>
                  {notification.body ? <Text className="mt-1 font-sans text-[13px] text-faint">{notification.body}</Text> : null}
                  <Text className="mt-1 font-sans text-[11px] text-faint">
                    {new Date(notification.created_at).toLocaleString(i18n.language)}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}