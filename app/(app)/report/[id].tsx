/**
 * Report detail: AI pace label + reasoning (Mid+ plan — gracefully absent on
 * Startup tier), manager comments, and same-day edit/delete (rule 5: controls
 * are disabled after editable_until, mirroring the server's hard cutoff).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import type { ReportDetail } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, ErrorText, Row, Screen } from "@/components/ui";

export default function ReportDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  // Backend serves this at GET /reports/{id} (flat shape per Changes_Summary A1).
  const report = useQuery({
    queryKey: ["reports", id],
    queryFn: async () => (await api.get<ReportDetail>(`/reports/${id}`)).data,
  });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: () => api.delete(`/reports/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reports"] }); router.back(); },
    onError: (e) => setError(errorDetail(e)),
  });

  return (
    <Screen>
      <QueryBoundary query={report}>
        {(data) => {
          const editable = new Date(data.editable_until).getTime() > Date.now();
          return (
            <>
              <Card>
                <Row className="justify-between">
                  <Text className="font-display text-lg text-ink">
                    {new Date(data.report_date).toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" })}
                  </Text>
                  <Badge label={`${data.hours}h`} tone="copper" />
                </Row>
                {data.project_name && <Text className="mt-1 font-sansmed text-[13px] text-faint">{data.project_name}</Text>}
                {editing ? (
                  <EditForm data={data} onDone={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["reports"] }); }} />
                ) : (
                  <Text className="mt-3 font-sans text-[14px] leading-6 text-ink">{data.summary}</Text>
                )}
                {!editing && (
                  <Row className="mt-4 gap-2">
                    <Button label={t("features.reportDetail.edit")} variant="outline" className="flex-1" disabled={!editable}
                      onPress={() => setEditing(true)} />
                    <Button label={t("features.reportDetail.delete")} variant="danger" className="flex-1" disabled={!editable}
                      loading={remove.isPending} onPress={() => remove.mutate()} />
                  </Row>
                )}
                {!editable && (
                  <Text className="mt-2 font-sans text-xs text-faint">
                    {t("features.reportDetail.lockedNote")}
                  </Text>
                )}
              </Card>

              {/* AI pace: null/absent on Startup-tier companies — show nothing broken. */}
              {data.ai_analysis ? (
                <Card className="mt-3">
                  <Row className="justify-between">
                    <Text className="font-sansbold text-[14px] text-ink">{t("features.reportDetail.workdayPace")}</Text>
                    <Badge
                      label={data.ai_analysis.pace_label}
                      tone={data.ai_analysis.pace_label === "heavy" ? "warn" : data.ai_analysis.pace_label === "steady" ? "good" : "neutral"}
                    />
                  </Row>
                  <Text className="mt-2 font-sans text-[13px] leading-5 text-faint">{data.ai_analysis.reasoning}</Text>
                </Card>
              ) : (
                <Card className="mt-3">
                  <Text className="font-sans text-[13px] text-faint">
                    {t("features.reportDetail.paceUnavailable")}
                  </Text>
                </Card>
              )}

              <Card className="mt-3">
                <Text className="mb-2 font-sansbold text-[14px] text-ink">{t("features.reportDetail.managerComments")}</Text>
                {data.comments.length === 0 && <Text className="font-sans text-[13px] text-faint">{t("features.reportDetail.noComments")}</Text>}
                {data.comments.map((comment) => (
                  <View key={comment.id} className="mb-2 rounded-xl bg-cream p-3">
                    <Text className="font-sans text-[13px] text-ink">{comment.comment}</Text>
                    <Text className="mt-1 font-sans text-[11px] text-faint">
                      {new Date(comment.created_at).toLocaleString(i18n.language)}
                    </Text>
                  </View>
                ))}
              </Card>
              {error && <ErrorText>{error}</ErrorText>}
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

function EditForm({ data, onDone }: { data: ReportDetail; onDone: () => void }) {
  const { t } = useTranslation();
  const [hours, setHours] = useState(String(data.hours));
  const [summary, setSummary] = useState(data.summary);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.patch(`/reports/${data.id}`, { hours: Number(hours), summary }),
    onSuccess: onDone,
    onError: (e) => setError(errorDetail(e)),
  });
  return (
    <View className="mt-3">
      <TextInput keyboardType="decimal-pad" value={hours} onChangeText={setHours}
        className="mb-2 h-11 rounded-xl border border-line bg-cream px-4 font-sans text-ink" />
      <TextInput multiline value={summary} onChangeText={setSummary} textAlignVertical="top"
        className="min-h-[80px] rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink" />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label={t("features.reportDetail.saveChanges")} variant="dark" className="mt-2" loading={save.isPending} onPress={() => save.mutate()} />
    </View>
  );
}