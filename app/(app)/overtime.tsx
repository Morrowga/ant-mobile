/**
 * Overtime — request-then-approve flow: submit a planned date/time +
 * reason, wait for manager/owner approval, THEN start the session on the
 * day it's approved for. Instant self-start no longer exists --
 * /overtime/start returns 409 without an approved request for today.
 *
 * Rule 2 (unchanged): an open session can ONLY be ended through the
 * closing-report step.
 *
 * "Your requests" and "Past sessions" are now tabs (requests shown by
 * default). Past sessions uses real cursor pagination (useInfiniteQuery +
 * FlatList's onEndReached) rather than fetching everything at once, and
 * each row navigates to its own detail screen on tap. Built as a single
 * FlatList with everything else as ListHeaderComponent, rather than
 * nesting a FlatList inside Screen's ScrollView (React Native warns
 * against/breaks on nested VirtualizedLists).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import type { Overtime, OvertimeRequest } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, EmptyText, ErrorText, Loading, Row, SectionTitle } from "@/components/ui";
import { SafeAreaView } from "react-native-safe-area-context";

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const todayStr = () => fmtDate(new Date());
const toDateOnly = (value: string) => value.slice(0, 10);

const PAGE_SIZE = 20;

export default function OvertimeScreen() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"requests" | "sessions">("requests");

  const fmtDateDisplay = (d: Date) => d.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });
  const fmtTimeDisplay = (d: Date) => d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  const requests = useQuery({
    queryKey: ["overtime", "requests", "me"],
    queryFn: async () => (await api.get<OvertimeRequest[]>("/overtime/requests/me")).data,
  });
  const sessionsPages = useInfiniteQuery({
    queryKey: ["overtime", "sessions", "paginated"],
    queryFn: async ({ pageParam = 0 }) =>
      (await api.get<Overtime[]>("/overtime/me", { params: { limit: PAGE_SIZE, offset: pageParam } })).data,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    initialPageParam: 0,
    enabled: tab === "sessions",
  });

  // Open session and "used" request ids need the full picture, not just
  // page 1 -- fetch a slightly larger unpaginated slice specifically for
  // that (separate from the paginated "Past sessions" list itself).
  const allSessionsForStatus = useQuery({
    queryKey: ["overtime", "all-for-status"],
    queryFn: async () => (await api.get<Overtime[]>("/overtime/me", { params: { limit: 200 } })).data,
  });

  const open = (allSessionsForStatus.data ?? []).find((s) => !s.end_at);
  const usedRequestIds = new Set((allSessionsForStatus.data ?? []).map((s) => s.request_id).filter((id) => id !== null));
  const approvedToday = (requests.data ?? []).find(
    (r) => r.status === "approved" && toDateOnly(r.requested_date) === todayStr() && !usedRequestIds.has(r.id),
  );
  const existingTodayRequest = (requests.data ?? []).find(
    (r) => toDateOnly(r.requested_date) === todayStr() && r.status !== "rejected" && !usedRequestIds.has(r.id),
  );

  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["overtime"] });
  };

  const startSession = useMutation({
    mutationFn: () => api.post("/overtime/start", {}),
    onSuccess: invalidateAll,
    onError: (e) => setError(errorDetail(e)),
  });

  const reportThenEnd = useMutation({
    mutationFn: async () => {
      if (!open) return;
      await api.post(`/overtime/${open.id}/report`, { summary: summary.trim() });
      await api.post("/overtime/end");
    },
    onSuccess: () => { invalidateAll(); setSummary(""); },
    onError: (e) => setError(errorDetail(e)),
  });

  const handleRefresh = () => {
    requests.refetch();
    allSessionsForStatus.refetch();
    if (tab === "sessions") sessionsPages.refetch();
  };
  const isRefreshing = requests.isFetching || allSessionsForStatus.isFetching || (tab === "sessions" && sessionsPages.isFetching && !sessionsPages.isFetchingNextPage);

  const header = (
    <View className="px-5 pt-2">
      {open ? (
        <Card className="bg-espresso">
          <Text style={{ color: "#ffffff" }} className="font-display text-lg">{t("features.overtime.running")}</Text>
          <Text className="mt-1 font-sans text-[13px] text-latte">
            {t("features.overtime.since", { time: new Date(open.start_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) })}
          </Text>
          {open.reason && <Text className="mt-2 font-sans text-[13px] text-latte">{t("features.overtime.reasonLabel", { reason: open.reason })}</Text>}
          <Text className="mb-1.5 mt-4 font-sansmed text-[13px] text-latte">
            {t("features.overtime.closingSummaryLabel")}
          </Text>
          <TextInput
            multiline value={summary} onChangeText={setSummary} textAlignVertical="top"
            placeholder={t("features.overtime.closingSummaryPlaceholder")}
            placeholderTextColor="#b9a794"
            className="min-h-[80px] rounded-xl bg-cream/95 px-4 py-3 font-sans text-ink"
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Button label={t("features.overtime.submitAndEnd")} variant="primary" className="mt-3"
            disabled={summary.trim().length < 3} loading={reportThenEnd.isPending}
            onPress={() => reportThenEnd.mutate()} />
        </Card>
      ) : approvedToday ? (
        <Card className="bg-espresso">
          <Text style={{ color: "#ffffff" }} className="font-display text-lg">{t("features.overtime.approvedForToday")}</Text>
          <Text className="mt-1 font-sans text-[13px] text-latte">
            {approvedToday.planned_start_time} – {approvedToday.planned_end_time} · {approvedToday.reason}
          </Text>
          {error && <ErrorText>{error}</ErrorText>}
          <Button label={t("features.overtime.startOvertime")} variant="primary" className="mt-3"
            loading={startSession.isPending} onPress={() => startSession.mutate()} />
        </Card>
      ) : (
        <Card>
          <Text className="font-display text-lg text-ink">{t("features.overtime.noApprovedToday")}</Text>
          <Text className="mt-1 font-sans text-[13px] text-faint">
            {t("features.overtime.submitBelowNoteMobile")}
          </Text>
        </Card>
      )}

      {existingTodayRequest ? (
        <>
          <SectionTitle>{t("features.overtime.requestOvertime")}</SectionTitle>
          <Card>
            <Text className="font-sansmed text-[14px] text-ink">
              {existingTodayRequest.status === "approved"
                ? t("features.overtime.alreadyHaveApproved")
                : t("features.overtime.alreadyHavePending")}
            </Text>
            <Text className="mt-1 font-sans text-[13px] text-faint">
              {existingTodayRequest.planned_start_time}–{existingTodayRequest.planned_end_time} · {existingTodayRequest.reason}
            </Text>
          </Card>
        </>
      ) : (
        <NewRequestForm onSubmitted={invalidateAll} />
      )}

      <Row className="mt-6 gap-2">
        <Pressable onPress={() => setTab("requests")} className="flex-1">
          <View className={`items-center rounded-xl border py-2.5 ${tab === "requests" ? "border-espresso bg-espresso" : "border-line bg-paper"}`}>
            <Text className={`font-sansbold text-[13px] ${tab === "requests" ? "text-cream" : "text-ink"}`}>{t("features.overtime.tabs.requests")}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setTab("sessions")} className="flex-1">
          <View className={`items-center rounded-xl border py-2.5 ${tab === "sessions" ? "border-espresso bg-espresso" : "border-line bg-paper"}`}>
            <Text className={`font-sansbold text-[13px] ${tab === "sessions" ? "text-cream" : "text-ink"}`}>{t("features.overtime.tabs.sessions")}</Text>
          </View>
        </Pressable>
      </Row>
      <View className="h-3" />
    </View>
  );

  if (tab === "requests") {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
        <QueryBoundary query={requests}>
          {(rows) => (
            <FlatList
              data={rows}
              keyExtractor={(r) => String(r.id)}
              ListHeaderComponent={header}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#6c4b36" />}
              ListEmptyComponent={<EmptyText>{t("features.overtime.noRequestsYet")}</EmptyText>}
              renderItem={({ item: r }) => (
                <Card className="mb-2 py-3">
                  <Row className="justify-between">
                    <Text className="font-sansmed text-[14px] text-ink">
                      {new Date(r.requested_date).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                      {"  "}{r.planned_start_time}–{r.planned_end_time}
                    </Text>
                    <Badge label={t(`features.overtime.statuses.${r.status}`)}
                      tone={r.status === "approved" ? "good" : r.status === "rejected" ? "bad" : "warn"} />
                  </Row>
                  <Text className="mt-1 font-sans text-[13px] text-faint">{r.reason}</Text>
                </Card>
              )}
            />
          )}
        </QueryBoundary>
      </SafeAreaView>
    );
  }

  // "sessions" tab -- flatten all fetched pages, tappable rows navigate to
  // the detail screen, onEndReached loads the next page. Filtered to
  // closed sessions BEFORE rendering (not inside renderItem returning
  // null), so the empty-state and row count are both accurate.
  const sessionRows = (sessionsPages.data?.pages ?? []).flat().filter((s) => !!s.end_at);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      <FlatList
        data={sessionRows}
        keyExtractor={(s) => String(s.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#6c4b36" />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (sessionsPages.hasNextPage && !sessionsPages.isFetchingNextPage) {
            sessionsPages.fetchNextPage();
          }
        }}
        ListEmptyComponent={
          sessionsPages.isLoading ? <Loading /> : <EmptyText>{t("features.overtime.noClosedSessions")}</EmptyText>
        }
        ListFooterComponent={sessionsPages.isFetchingNextPage ? <Loading /> : null}
        renderItem={({ item: session }) => (
          <Pressable onPress={() => router.push({ pathname: "/(app)/overtime/[id]", params: { id: String(session.id) } })}>
            <Card className="mb-2 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-sansmed text-[14px] text-ink">
                  {new Date(session.start_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                </Text>
                <Badge label={`${session.hours ?? "?"}h`} tone="copper" />
              </View>
              {session.reason && <Text className="mt-1 font-sans text-[13px] text-ink">{t("features.overtime.reasonLabel", { reason: session.reason })}</Text>}
              {session.summary && <Text className="mt-1 font-sans text-[13px] text-faint">{session.summary}</Text>}
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function NewRequestForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [openPicker, setOpenPicker] = useState<"date" | "start" | "end" | null>(null);
  const [pickerTemp, setPickerTemp] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const fmtDateDisplay = (d: Date) => d.toLocaleDateString(i18n.language, { weekday: "short", month: "short", day: "numeric" });
  const fmtTimeDisplay = (d: Date) => d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  const submit = useMutation({
    mutationFn: () =>
      api.post("/overtime/requests", {
        requested_date: date ? fmtDate(date) : "",
        planned_start_time: startTime ? fmtTime(startTime) : "",
        planned_end_time: endTime ? fmtTime(endTime) : "",
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setDate(null); setStartTime(null); setEndTime(null); setReason("");
      onSubmitted();
    },
    onError: (e) => setError(errorDetail(e)),
  });

  function openPickerFor(kind: typeof openPicker, current: Date | null) {
    setPickerTemp(current ?? new Date());
    setOpenPicker(kind);
  }

  function commit(kind: typeof openPicker, value: Date) {
    if (kind === "date") setDate(value);
    else if (kind === "start") setStartTime(value);
    else if (kind === "end") setEndTime(value);
  }

  function handleChange(value: Date | undefined) {
    if (Platform.OS === "android") {
      setOpenPicker(null);
      if (value) commit(openPicker, value);
      return;
    }
    if (value) setPickerTemp(value);
  }

  function handleDone() {
    commit(openPicker, pickerTemp);
    setOpenPicker(null);
  }

  // New: endTime <= startTime is now VALID -- it means the overtime spans
  // into the next calendar day (e.g. 23:30 to 02:00), matching the
  // backend's own relaxed validation. Only reject the exact same time for
  // both (zero-length).
  const spansNextDay = !!startTime && !!endTime && fmtTime(endTime) <= fmtTime(startTime);
  const canSubmit = !!date && !!startTime && !!endTime && !!reason.trim() &&
    fmtTime(startTime) !== fmtTime(endTime);

  return (
    <>
      <SectionTitle>{t("features.overtime.requestOvertime")}</SectionTitle>
      <Card>
        <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.overtime.date")}</Text>
        <PickerField value={date ? fmtDateDisplay(date) : t("features.overtime.selectADate")} onPress={() => openPickerFor("date", date)} />
        <Row className="mt-3 gap-3">
          <View className="flex-1">
            <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.overtime.startTime")}</Text>
            <PickerField value={startTime ? fmtTimeDisplay(startTime) : t("features.overtime.selectTime")} onPress={() => openPickerFor("start", startTime)} />
          </View>
          <View className="flex-1">
            <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{t("features.overtime.endTime")}</Text>
            <PickerField value={endTime ? fmtTimeDisplay(endTime) : t("features.overtime.selectTime")} onPress={() => openPickerFor("end", endTime)} />
          </View>
        </Row>

        {openPicker && (
          <DateTimePicker
            value={pickerTemp}
            mode={openPicker === "date" ? "date" : "time"}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={openPicker === "date" ? new Date() : undefined}
            onChange={(_, d) => handleChange(d)}
          />
        )}
        {Platform.OS === "ios" && openPicker && (
          <Button label={t("features.overtime.done")} variant="outline" className="mt-2" onPress={handleDone} />
        )}
        {spansNextDay && (
          <Text className="mt-2 font-sans text-xs text-faint">
            {t("features.overtime.spansNextDayNoteMobile")}
          </Text>
        )}

        <Text className="mb-1.5 mt-3 font-sansmed text-[13px] text-ink">{t("features.overtime.whyNeedOvertime")}</Text>
        <TextInput
          multiline value={reason} onChangeText={setReason} textAlignVertical="top"
          placeholder={t("features.overtime.reasonPlaceholder")}
          placeholderTextColor="#8a8580"
          className="min-h-[70px] rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink"
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button label={t("features.overtime.sendRequest")} variant="dark" className="mt-3"
          disabled={!canSubmit} loading={submit.isPending} onPress={() => submit.mutate()} />
      </Card>
    </>
  );
}

function PickerField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="h-11 justify-center rounded-xl border border-line bg-cream px-4">
      <Text className="font-sans text-ink">{value}</Text>
    </Pressable>
  );
}