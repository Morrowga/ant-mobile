import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { Overtime, Report } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, Row, Screen, SectionTitle, Subtitle, Title } from "@/components/ui";

export const isEditable = (report: Report) => new Date(report.editable_until).getTime() > Date.now();

export default function Reports() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<"daily" | "overtime">("daily");
  const reports = useQuery({
    queryKey: ["reports", "me"],
    queryFn: async () => (await api.get<Report[]>("/reports/me")).data,
  });
  const overtime = useQuery({
    queryKey: ["overtime", "me"],
    queryFn: async () => (await api.get<Overtime[]>("/overtime/me")).data,
    enabled: tab === "overtime",
  });

  const isRefreshing = tab === "daily" ? reports.isFetching : overtime.isFetching;
  const handleRefresh = () => {
    if (tab === "daily") reports.refetch();
    else overtime.refetch();
  };

  return (
    <Screen refreshing={isRefreshing} onRefresh={handleRefresh}>
      <Title>{t("features.reports.pageTitle")}</Title>
      <Subtitle>{t("features.reports.pageDescription")}</Subtitle>

      <Row className="mt-4 gap-2">
        <Pressable onPress={() => setTab("daily")} className="flex-1">
          <View className={`items-center rounded-xl border py-2.5 ${tab === "daily" ? "border-espresso bg-espresso" : "border-line bg-paper"}`}>
            <Text className={`font-sansbold text-[13px] ${tab === "daily" ? "text-cream" : "text-ink"}`}>{t("features.reports.tabs.daily")}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setTab("overtime")} className="flex-1">
          <View className={`items-center rounded-xl border py-2.5 ${tab === "overtime" ? "border-espresso bg-espresso" : "border-line bg-paper"}`}>
            <Text className={`font-sansbold text-[13px] ${tab === "overtime" ? "text-cream" : "text-ink"}`}>{t("features.reports.tabs.overtime")}</Text>
          </View>
        </Pressable>
      </Row>

      {tab === "daily" ? (
        <QueryBoundary query={reports}>
          {(rows) => (
            <>
              <SectionTitle>{t("features.reports.pageTitle")}</SectionTitle>
              <View>
                {rows.length === 0 && <EmptyText>{t("features.reports.daily.empty")}</EmptyText>}
                {rows.map((report) => (
                  <Link key={report.id} href={{ pathname: "/(app)/report/[id]", params: { id: String(report.id) } }} asChild>
                    <Pressable>
                      <Card className="mb-2">
                        <Row className="justify-between">
                          <Text className="font-sansbold text-[15px] text-ink">
                            {new Date(report.report_date).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                            {"  ·  "}{report.hours}h
                          </Text>
                          {isEditable(report) ? <Badge label={t("features.reports.daily.editableToday")} tone="copper" /> : <Badge label={t("features.reports.daily.locked")} />}
                        </Row>
                        <Text numberOfLines={2} className="mt-1 font-sans text-[13px] text-faint">{report.summary}</Text>
                      </Card>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </>
          )}
        </QueryBoundary>
      ) : (
        <View className="mt-4">
          <QueryBoundary query={overtime}>
            {(rows) => (
              <View>
                {rows.length === 0 && <EmptyText>{t("features.reports.overtime.empty")}</EmptyText>}
                {rows.map((ot) => (
                  <Link key={ot.id} href={{ pathname: "/(app)/overtime/[id]", params: { id: String(ot.id) } }} asChild>
                    <Pressable>
                      <Card className="mb-2">
                        <Row className="justify-between">
                          <Text className="font-sansbold text-[15px] text-ink">
                            {new Date(ot.start_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                            {ot.hours !== null ? `  ·  ${ot.hours}h` : ""}
                          </Text>
                          {ot.end_at ? <Badge label={t("features.reports.overtime.closed")} /> : <Badge label={t("features.reports.overtime.inProgress")} tone="warn" />}
                        </Row>
                        <Text numberOfLines={2} className="mt-1 font-sans text-[13px] text-faint">
                          {ot.summary ?? ot.reason ?? t("features.reports.overtime.noSummaryYet")}
                        </Text>
                      </Card>
                    </Pressable>
                  </Link>
                ))}
              </View>
            )}
          </QueryBoundary>
        </View>
      )}
    </Screen>
  );
}