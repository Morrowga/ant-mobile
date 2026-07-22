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
import { Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { Overtime } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, Row, Screen } from "@/components/ui";

const fmtDateTime = (value: string) =>
  new Date(value).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function OvertimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const overtime = useQuery({
    queryKey: ["overtime", id],
    queryFn: async () => (await api.get<Overtime>(`/overtime/${id}`)).data,
  });

  return (
    <Screen>
      <QueryBoundary query={overtime}>
        {(ot) => (
          <>
            <Card>
              <Row className="justify-between">
                <Text className="font-display text-lg text-ink">{fmtDateTime(ot.start_at)}</Text>
                {ot.end_at ? <Badge label="closed" /> : <Badge label="in progress" tone="warn" />}
              </Row>
              <Text className="mt-1 font-sansmed text-[13px] text-faint">
                {ot.end_at ? `Ended ${fmtDateTime(ot.end_at)}` : "Still running"}
                {ot.hours !== null ? ` · ${ot.hours}h` : ""}
              </Text>
              <Text className="mt-1 font-sans text-xs capitalize text-faint">
                Initiated by {ot.initiated_by}
              </Text>
            </Card>

            {ot.reason && (
              <Card className="mt-3">
                <Text className="mb-1 font-sansbold text-[14px] text-ink">Reason</Text>
                <Text className="font-sans text-[14px] leading-6 text-ink">{ot.reason}</Text>
              </Card>
            )}

            <Card className="mt-3">
              <Text className="mb-1 font-sansbold text-[14px] text-ink">Closing summary</Text>
              {ot.summary ? (
                <Text className="font-sans text-[14px] leading-6 text-ink">{ot.summary}</Text>
              ) : (
                <Text className="font-sans text-[13px] text-faint">
                  {ot.end_at ? "No summary was recorded." : "Not closed yet — a summary is required before this session can end."}
                </Text>
              )}
            </Card>

            {/* ai_summary is a separate optional field on the Overtime type
                -- shown only if actually present, since overtime doesn't
                go through the same AI workload analysis pipeline as daily
                reports. */}
            {ot.ai_summary && (
              <Card className="mt-3">
                <Text className="mb-1 font-sansbold text-[14px] text-ink">AI summary</Text>
                <Text className="font-sans text-[13px] leading-5 text-faint">{ot.ai_summary}</Text>
              </Card>
            )}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}