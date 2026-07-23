import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import type { LeaveRequest } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, EmptyText, ErrorText, Row, Screen, SectionTitle } from "@/components/ui";

// NOTE: values stay untranslated here (used as API values); only the BADGE
// LABEL shown to the user is translated, via features.leave.types.*
const TYPES = ["annual", "sick", "unpaid", "other"];

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

type PickerKind = "start" | "end" | "startTime" | "endTime" | null;

export default function Leave() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["leave", "me"],
    queryFn: async () => (await api.get<LeaveRequest[]>("/leave-requests/me")).data,
  });
  const [type, setType] = useState("annual");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [partialDay, setPartialDay] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmtDateDisplay = (d: Date) => d.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });
  const fmtTimeDisplay = (d: Date) => d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  const [openPicker, setOpenPicker] = useState<PickerKind>(null);
  // The picker's currently-displayed value while open. Initialized to the
  // existing value (or "now") the moment it opens, and updated as the user
  // scrolls -- committed explicitly on "Done" (iOS) rather than relying on
  // onChange alone, since iOS's spinner never fires onChange at all if the
  // person doesn't actually touch/scroll it (accepting the default as-is).
  const [pickerTemp, setPickerTemp] = useState<Date>(new Date());

  function openPickerFor(kind: PickerKind, current: Date | null) {
    setPickerTemp(current ?? new Date());
    setOpenPicker(kind);
  }

  function commit(kind: PickerKind, value: Date) {
    if (kind === "start") setStart(value);
    else if (kind === "end") setEnd(value);
    else if (kind === "startTime") setStartTime(value);
    else if (kind === "endTime") setEndTime(value);
  }

  function handleChange(date: Date | undefined) {
    if (Platform.OS === "android") {
      // Android's dialog only calls onChange on confirm (with the final
      // value, changed or not) or not at all if cancelled -- safe to commit
      // directly and close here.
      setOpenPicker(null);
      if (date) commit(openPicker, date);
      return;
    }
    // iOS: fires continuously while scrolling -- just track locally, the
    // actual commit happens when "Done" is tapped.
    if (date) setPickerTemp(date);
  }

  function handleDone() {
    commit(openPicker, pickerTemp);
    setOpenPicker(null);
  }

  const request = useMutation({
    mutationFn: () =>
      api.post("/leave-requests", {
        type,
        start_date: start ? fmtDate(start) : "",
        end_date: partialDay ? (start ? fmtDate(start) : "") : end ? fmtDate(end) : "",
        ...(partialDay && startTime && endTime && { start_time: fmtTime(startTime), end_time: fmtTime(endTime) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave"] });
      setStart(null); setEnd(null); setStartTime(null); setEndTime(null);
    },
    onError: (e) => setError(errorDetail(e)),
  });

  const canSubmit = partialDay
    ? !!start && !!startTime && !!endTime && fmtTime(startTime) < fmtTime(endTime)
    : !!start && !!end && start <= end;

  return (
    <Screen>
      <SectionTitle>{t("features.leave.requestLeave")}</SectionTitle>
      <Card>
        <Row className="mb-3 flex-wrap gap-2">
          {TYPES.map((typeValue) => (
            <Pressable key={typeValue} onPress={() => setType(typeValue)}>
              <Badge label={t(`features.leave.types.${typeValue}`)} tone={type === typeValue ? "copper" : "neutral"} />
            </Pressable>
          ))}
        </Row>

        <Pressable
          onPress={() => setPartialDay((v) => !v)}
          className="mb-3 flex-row items-center justify-between rounded-xl border border-line bg-cream px-4 py-3"
        >
          <View>
            <Text className="font-sansmed text-[13px] text-ink">{t("features.leave.partialDayQuestion")}</Text>
            <Text className="mt-0.5 font-sans text-xs text-faint">{t("features.leave.partialDayExample")}</Text>
          </View>
          <Badge label={partialDay ? t("features.leave.on") : t("features.leave.off")} tone={partialDay ? "copper" : "neutral"} />
        </Pressable>

        {partialDay ? (
          <>
            <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.leave.date")}</Text>
            <PickerField
              value={start ? fmtDateDisplay(start) : t("features.leave.selectADate")}
              onPress={() => openPickerFor("start", start)}
            />
            <Row className="mt-3 gap-3">
              <View className="flex-1">
                <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.leave.startTime")}</Text>
                <PickerField
                  value={startTime ? fmtTimeDisplay(startTime) : t("features.leave.selectTime")}
                  onPress={() => openPickerFor("startTime", startTime)}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.leave.endTime")}</Text>
                <PickerField
                  value={endTime ? fmtTimeDisplay(endTime) : t("features.leave.selectTime")}
                  onPress={() => openPickerFor("endTime", endTime)}
                />
              </View>
            </Row>
          </>
        ) : (
          <>
            <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.leave.firstDay")}</Text>
            <PickerField value={start ? fmtDateDisplay(start) : t("features.leave.selectADate")} onPress={() => openPickerFor("start", start)} />
            <Text className="mb-1.5 mt-3 font-sansmed text-[13px] text-ink">{t("features.leave.lastDay")}</Text>
            <PickerField value={end ? fmtDateDisplay(end) : t("features.leave.selectADate")} onPress={() => openPickerFor("end", end)} />
          </>
        )}

        {openPicker && (
          <DateTimePicker
            value={pickerTemp}
            mode={openPicker === "startTime" || openPicker === "endTime" ? "time" : "date"}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, d) => handleChange(d)}
          />
        )}
        {Platform.OS === "ios" && openPicker && (
          <Button label={t("features.leave.done")} variant="outline" className="mt-2" onPress={handleDone} />
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <Button label={t("features.leave.sendRequest")} variant="dark" className="mt-3"
          disabled={!canSubmit} loading={request.isPending}
          onPress={() => request.mutate()} />
      </Card>

      <SectionTitle>{t("features.leave.yourRequests")}</SectionTitle>
      <QueryBoundary query={history}>
        {(rows) => (
          <View>
            {rows.length === 0 && <EmptyText>{t("features.leave.empty")}</EmptyText>}
            {rows.map((leave) => (
              <Card key={leave.id} className="mb-2 flex-row items-center justify-between py-3">
                <View>
                  <Text className="font-sansmed text-[14px] capitalize text-ink">{t(`features.leave.types.${leave.type}`, leave.type)}</Text>
                  <Text className="font-sans text-xs text-faint">
                    {leave.start_date}{leave.start_date !== leave.end_date ? ` → ${leave.end_date}` : ""}
                    {leave.start_time && leave.end_time ? `  ·  ${leave.start_time}–${leave.end_time}` : ""}
                  </Text>
                </View>
                <Badge label={t(`features.leave.statuses.${leave.status}`)}
                  tone={leave.status === "approved" ? "good" : leave.status === "rejected" ? "bad" : "warn"} />
              </Card>
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}

function PickerField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="h-11 justify-center rounded-xl border border-line bg-cream px-4">
      <Text className="font-sans text-ink">{value}</Text>
    </Pressable>
  );
}