import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import type { FeedbackTicket } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, EmptyText, ErrorText, Row, Screen, SectionTitle } from "@/components/ui";

// NOTE: values stay untranslated here (used as API values); only the
// BADGE LABEL shown to the user is translated, via features.feedback.categories.*
const CATEGORIES = ["workload", "workplace", "management", "harassment", "other"];

export default function Feedback() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mine = useQuery({
    queryKey: ["feedback", "me"],
    queryFn: async () => (await api.get<FeedbackTicket[]>("/feedback/me")).data,
  });
  const [category, setCategory] = useState("workload");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => api.post("/feedback", { category, message: message.trim(), anonymous }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feedback"] }); setMessage(""); },
    onError: (e) => setError(errorDetail(e)),
  });

  return (
    <Screen>
      <SectionTitle>{t("features.feedback.raiseSomething")}</SectionTitle>
      <Card>
        <Row className="mb-3 flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)}>
              <Badge label={t(`features.feedback.categories.${c}`)} tone={category === c ? "copper" : "neutral"} />
            </Pressable>
          ))}
        </Row>
        {category === "harassment" && (
          <Text className="mb-2 font-sans text-xs text-faint">
            {t("features.feedback.harassmentNote")}
          </Text>
        )}
        <TextInput
          multiline value={message} onChangeText={setMessage} textAlignVertical="top"
          placeholder={t("features.feedback.messagePlaceholder")}
          placeholderTextColor="#8a8580"
          className="min-h-[100px] rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink"
        />
        <Row className="mt-3 justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-sansmed text-[14px] text-ink">{t("features.feedback.submitAnonymously")}</Text>
            <Text className="font-sans text-xs text-faint">{t("features.feedback.anonymousNote")}</Text>
          </View>
          <Switch value={anonymous} onValueChange={setAnonymous}
            trackColor={{ true: "#bfa287", false: "#e4ddd6" }} thumbColor="#6c4b36" />
        </Row>
        {error && <ErrorText>{error}</ErrorText>}
        <Button label={t("features.feedback.sendFeedback")} variant="dark" className="mt-3"
          disabled={message.trim().length < 5} loading={submit.isPending} onPress={() => submit.mutate()} />
      </Card>

      <SectionTitle>{t("features.feedback.yourTickets")}</SectionTitle>
      <QueryBoundary query={mine}>
        {(rows) => (
          <View>
            {rows.length === 0 && <EmptyText>{t("features.feedback.noneRaised")}</EmptyText>}
            {rows.map((ticket) => (
              <Card key={ticket.id} className="mb-2 py-3">
                <Row className="justify-between">
                  <Badge label={t(`features.feedback.categories.${ticket.category}`, ticket.category)} />
                  <Badge label={t(`features.feedback.statuses.${ticket.status}`, ticket.status.replace("_", " "))}
                    tone={ticket.status === "resolved" ? "good" : ticket.status === "new" ? "warn" : "neutral"} />
                </Row>
                <Text numberOfLines={2} className="mt-2 font-sans text-[13px] text-faint">{ticket.message}</Text>
                {ticket.anonymous && <Text className="mt-1 font-sans text-[11px] text-copper">{t("features.feedback.submittedAnonymously")}</Text>}
              </Card>
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}