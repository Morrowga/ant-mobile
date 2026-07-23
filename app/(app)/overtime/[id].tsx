/**
 * Overtime detail — read-only view of a single overtime session. Kept
 * separate from the daily Report detail screen since the data shape is
 * genuinely different: no project/hours breakdown, no AI pace label, just
 * a single summary string plus planned reason/times. Starting or ending an
 * overtime session itself lives on the dedicated Overtime request/start
 * flow, not here -- this is purely a look-back at what happened.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { Overtime } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, Row, Screen } from "@/components/ui";

export default function OvertimeDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const overtime = useQuery({
    queryKey: ["overtime", id],
    queryFn: async () => (await api.get<Overtime>(`/overtime/${id}`)).data,
  });

  const fmtDateTime = (value: string) =>
    new Date(value).toLocaleString(i18n.language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Screen>
      <QueryBoundary query={overtime}>
        {(ot) => (
          <>
            <Card>
              <Row className="justify-between">
                <Text className="font-display text-lg text-ink">{fmtDateTime(ot.start_at)}</Text>
                {ot.end_at ? <Badge label={t("features.overtimeDetail.closed")} /> : <Badge label={t("features.overtimeDetail.inProgress")} tone="warn" />}
              </Row>
              <Text className="mt-1 font-sansmed text-[13px] text-faint">
                {ot.end_at ? t("features.overtimeDetail.ended", { time: fmtDateTime(ot.end_at) }) : t("features.overtimeDetail.stillRunning")}
                {ot.hours !== null ? ` · ${ot.hours}h` : ""}
              </Text>
              <Text className="mt-1 font-sans text-xs capitalize text-faint">
                {t("features.overtimeDetail.initiatedBy", { who: ot.initiated_by })}
              </Text>
            </Card>

            {ot.reason && (
              <Card className="mt-3">
                <Text className="mb-1 font-sansbold text-[14px] text-ink">{t("features.overtimeDetail.reason")}</Text>
                <Text className="font-sans text-[14px] leading-6 text-ink">{ot.reason}</Text>
              </Card>
            )}

            <Card className="mt-3">
              <Text className="mb-1 font-sansbold text-[14px] text-ink">{t("features.overtimeDetail.closingSummary")}</Text>
              {ot.summary ? (
                <Text className="font-sans text-[14px] leading-6 text-ink">{ot.summary}</Text>
              ) : (
                <Text className="font-sans text-[13px] text-faint">
                  {ot.end_at ? t("features.overtimeDetail.noSummaryRecorded") : t("features.overtimeDetail.notClosedYet")}
                </Text>
              )}
            </Card>

            {/* ai_summary is a separate optional field on the Overtime type
                -- shown only if actually present, since overtime doesn't
                go through the same AI workload analysis pipeline as daily
                reports. */}
            {ot.ai_summary && (
              <Card className="mt-3">
                <Text className="mb-1 font-sansbold text-[14px] text-ink">{t("features.overtimeDetail.aiSummary")}</Text>
                <Text className="font-sans text-[13px] leading-5 text-faint">{ot.ai_summary}</Text>
              </Card>
            )}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}