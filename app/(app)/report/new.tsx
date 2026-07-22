/**
 * Multi-entry daily report. POST /reports takes an ARRAY of
 * { project_id, hours, summary }; "nothing to report" is its own endpoint.
 * Submission is offline-safe (rule 7).
 *
 * Also reached via the checkout flow (Today screen redirects here with
 * ?forCheckout=true if checkout is rejected for having no report yet) --
 * in that mode, actual working hours are shown as a ceiling, and a
 * successful submit immediately triggers the real checkout afterward.
 *
 * If there's a pending health check-in, the report FORM ITSELF is hidden
 * entirely and replaced with a single button to go answer it -- checked
 * proactively via a query, not reactively after a failed submit. This
 * avoids the earlier approach of navigating away to the Health tab, which
 * reset all the entries typed so far; staying on this same screen and
 * just swapping what's rendered means nothing is ever lost.
 *
 * Time entry is separate Hours + Minutes fields (not a single decimal
 * field) -- nobody should have to know that 15 minutes is "0.25".
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { runOrQueue } from "@/lib/offline-queue";
import type { AttendanceStatus, Project } from "@/lib/types";
import { Badge, Button, Card, ErrorText, Row, Screen } from "@/components/ui";

interface Entry { project_id: number | null; hours: string; minutes: string; summary: string }
interface PendingPrompt { id: number; type: string; sent_at: string; responded_at: string | null }
interface TodayInvoice {
  scheduled_minutes: number; elapsed_minutes: number; break_minutes: number;
  late_minutes: number; no_response_minutes: number; credited_minutes: number;
  deductions_enabled: boolean;
}

const fmtMinutes = (mins: number) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
};

/** e.g. hours="0", minutes="15" -> 0.25 */
const toDecimalHours = (hours: string, minutes: string) => {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return Math.round((h + m / 60) * 100) / 100;
};

export default function NewReport() {
  const { forCheckout } = useLocalSearchParams<{ forCheckout?: string }>();
  const isForCheckout = forCheckout === "true";
  const qc = useQueryClient();

  const pending = useQuery({
    queryKey: ["health", "prompts", "pending"],
    queryFn: async () => (await api.get<PendingPrompt[]>("/health/prompts/pending")).data,
  });

  // Coming back from answering a health check-in is a stack pop, not a
  // remount -- explicitly refetch on focus so this screen notices the
  // prompt is now answered and switches from the button back to the form.
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["health", "prompts", "pending"] });
    }, [qc])
  );

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects")).data,
  });
  const status = useQuery({
    queryKey: ["attendance", "status"],
    queryFn: async () => (await api.get<AttendanceStatus>("/attendance/me/status")).data,
    enabled: isForCheckout, // only need this when the working-hours ceiling actually matters
  });
  const [entries, setEntries] = useState<Entry[]>([{ project_id: null, hours: "", minutes: "", summary: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const invoice = useQuery({
    queryKey: ["attendance", "today-invoice"],
    queryFn: async () => (await api.get<TodayInvoice>("/attendance/me/today-invoice")).data,
    enabled: isForCheckout && invoiceOpen,
  });

  const update = (i: number, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((entry, j) => (j === i ? { ...entry, ...patch } : entry)));

  const actualMinutes = status.data?.actual_working_minutes_today ?? null;
  const totalEnteredHours = entries.reduce((sum, e) => sum + toDecimalHours(e.hours, e.minutes), 0);
  const overCeiling = isForCheckout && actualMinutes !== null && totalEnteredHours > actualMinutes / 60 + 0.01;

  const submit = useMutation({
    mutationFn: async () => {
      setError(null);
      const body = entries.map((entry) => ({
        project_id: entry.project_id,
        hours: toDecimalHours(entry.hours, entry.minutes),
        summary: entry.summary.trim(),
      }));
      const result = await runOrQueue({ kind: "report", path: "/reports", body }, () => api.post("/reports", body));
      // Report submitted successfully -- now actually check out, since
      // that's the entire reason this screen was reached in checkout mode.
      if (isForCheckout && !result.queued) {
        await api.post("/attendance/check-out");
      }
      return result;
    },
    onSuccess: ({ queued }) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      if (queued) setError(null);
      if (isForCheckout) {
        router.replace("/(app)/(tabs)/today");
      } else {
        router.back();
      }
    },
    onError: (e) => setError(errorDetail(e)),
  });

  const nothingToReport = useMutation({
    mutationFn: () => api.post("/reports/no-project-today"),
    onSuccess: () => router.back(),
    onError: (e) => setError(errorDetail(e)),
  });

  const valid = entries.every((entry) => toDecimalHours(entry.hours, entry.minutes) > 0 && entry.summary.trim().length > 0) && !overCeiling;

  // ---- pending health check-in: hide the whole form, show one button ----
  if (pending.isLoading) {
    return <Screen><Text className="font-sans text-sm text-faint">Loading…</Text></Screen>;
  }

  const pendingPrompts = pending.data ?? [];
  if (pendingPrompts.length > 0) {
    const single = pendingPrompts.length === 1 ? pendingPrompts[0] : null;
    const goAnswer = () => {
      if (single?.type === "sleep_checkin") {
        router.push({ pathname: "/(app)/health-checkin/sleep", params: { promptId: String(single.id) } });
      } else if (single?.type === "mood_water_checkin") {
        router.push({ pathname: "/(app)/health-checkin/mood-water", params: { promptId: String(single.id) } });
      } else {
        router.push("/(app)/(tabs)/health");
      }
    };
    return (
      <Screen>
        <Card className="items-center py-8">
          <Text className="text-center font-display text-lg text-ink">Answer your health check-in first</Text>
          <Text className="mt-2 text-center font-sans text-[13px] text-faint">
            {pendingPrompts.length > 1
              ? `You have ${pendingPrompts.length} unanswered check-ins today.`
              : "Just one quick question, then you can come straight back here."}
          </Text>
          <Button label="Answer now" variant="dark" className="mt-4 w-full" onPress={goAnswer} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {isForCheckout && (
        <Card className="mb-3 bg-latte/40">
          <Text className="font-sansmed text-[13px] text-espresso">
            {actualMinutes !== null
              ? `You've actually worked ${fmtMinutes(actualMinutes)} today (breaks excluded). Log your tasks below — the total can be less, but not more.`
              : "Fill out today's report to finish checking out."}
          </Text>
        </Card>
      )}

      {entries.map((entry, i) => (
        <Card key={i} className="mb-3">
          <Text className="mb-2 font-sansbold text-[13px] text-faint">ENTRY {i + 1}</Text>
          <Text className="mb-1.5 font-sansmed text-[13px] text-ink">Project</Text>
          <Row className="mb-3 flex-wrap gap-2">
            {(projects.data ?? []).map((project) => (
              <Pressable key={project.id} onPress={() => update(i, { project_id: project.id })}>
                <Badge label={project.name} tone={entry.project_id === project.id ? "copper" : "neutral"} />
              </Pressable>
            ))}
          </Row>
          <Text className="mb-1.5 font-sansmed text-[13px] text-ink">Time spent</Text>
          <Row className="mb-3 gap-2">
            <View className="flex-1">
              <TextInput
                keyboardType="number-pad"
                className="h-12 rounded-xl border border-line bg-cream px-4 font-sans text-ink"
                value={entry.hours}
                onChangeText={(hours) => update(i, { hours: hours.replace(/[^0-9]/g, "") })}
                placeholder="0"
                placeholderTextColor="#8a8580"
              />
              <Text className="mt-1 text-center font-sans text-[11px] text-faint">hours</Text>
            </View>
            <View className="flex-1">
              <TextInput
                keyboardType="number-pad"
                className="h-12 rounded-xl border border-line bg-cream px-4 font-sans text-ink"
                value={entry.minutes}
                onChangeText={(minutes) => {
                  const digits = minutes.replace(/[^0-9]/g, "");
                  const clamped = digits === "" ? "" : String(Math.min(59, Number(digits)));
                  update(i, { minutes: clamped });
                }}
                placeholder="0"
                placeholderTextColor="#8a8580"
              />
              <Text className="mt-1 text-center font-sans text-[11px] text-faint">minutes</Text>
            </View>
          </Row>
          <Text className="mb-1.5 font-sansmed text-[13px] text-ink">What did you work on?</Text>
          <TextInput
            multiline
            className="min-h-[80px] rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink"
            value={entry.summary}
            onChangeText={(summary) => update(i, { summary })}
            placeholder="A few sentences — this is what your manager (and the pace analysis) reads."
            placeholderTextColor="#8a8580"
            textAlignVertical="top"
          />
        </Card>
      ))}

      {overCeiling && (
        <ErrorText>
          Total entered ({fmtMinutes(Math.round(totalEnteredHours * 60))}) is more than your actual working hours
          ({actualMinutes !== null ? fmtMinutes(actualMinutes) : "?"}). Reduce your entries to fit.
        </ErrorText>
      )}
      {error && <ErrorText>{error}</ErrorText>}

      {isForCheckout ? (
        <Row className="mt-3 gap-2">
          <Button label="Today invoice" variant="outline" className="flex-1" onPress={() => setInvoiceOpen(true)} />
          <Button label="Add another entry" variant="outline" className="flex-1"
            onPress={() => setEntries((prev) => [...prev, { project_id: null, hours: "", minutes: "", summary: "" }])} />
        </Row>
      ) : (
        <Button label="Add another entry" variant="outline" className="mt-3"
          onPress={() => setEntries((prev) => [...prev, { project_id: null, hours: "", minutes: "", summary: "" }])} />
      )}

      <Button label={isForCheckout ? "Submit & check out" : "Submit report"} variant="dark" className="mt-3"
        disabled={!valid} loading={submit.isPending} onPress={() => submit.mutate()} />

      {/* "Nothing to report" doesn't create a Report row, so it can't
          satisfy the checkout gate -- hidden in checkout mode to avoid a
          confusing dead end. */}
      {!isForCheckout && (
        <View className="mt-6 border-t border-line pt-4">
          <Button label="Nothing to report today" variant="ghost"
            loading={nothingToReport.isPending} onPress={() => nothingToReport.mutate()} />
        </View>
      )}

      <TodayInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} invoice={invoice.data} loading={invoice.isLoading} />
    </Screen>
  );
}

function TodayInvoiceModal({ open, onClose, invoice, loading }: {
  open: boolean; onClose: () => void; invoice: TodayInvoice | undefined; loading: boolean;
}) {
  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-ink/40 px-6">
        <View className="w-full rounded-2xl bg-paper p-5">
          <Text className="font-display text-lg text-ink">Today's invoice</Text>
          {loading || !invoice ? (
            <Text className="mt-3 font-sans text-sm text-faint">Loading…</Text>
          ) : (
            <View className="mt-3">
              <InvoiceRow label="Scheduled shift" value={fmtMinutes(invoice.scheduled_minutes)} />
              <InvoiceRow label="Time checked in" value={fmtMinutes(invoice.elapsed_minutes)} />
              <InvoiceRow label="Break time (excluded)" value={`− ${fmtMinutes(invoice.break_minutes)}`} muted />
              <InvoiceRow
                label="Late arrival"
                value={invoice.late_minutes > 0 ? fmtMinutes(invoice.late_minutes) : "none"}
                muted
              />
              {invoice.deductions_enabled ? (
                <InvoiceRow
                  label="Unanswered presence checks"
                  value={invoice.no_response_minutes > 0 ? `− ${fmtMinutes(invoice.no_response_minutes)}` : "none"}
                  muted={invoice.no_response_minutes === 0}
                />
              ) : (
                <Text className="mt-1 font-sans text-[12px] text-faint">
                  No-response deductions are turned off by your company.
                </Text>
              )}
              <View className="mt-3 border-t border-line pt-3">
                <InvoiceRow label="Credited hours" value={fmtMinutes(invoice.credited_minutes)} bold />
              </View>
            </View>
          )}
          <Button label="Close" variant="dark" className="mt-4" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function InvoiceRow({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <Row className="justify-between py-1">
      <Text className={`font-sans text-[13px] ${bold ? "font-sansbold text-ink" : "text-faint"}`}>{label}</Text>
      <Text className={`font-sans text-[13px] tabular ${bold ? "font-sansbold text-ink" : muted ? "text-faint" : "text-ink"}`}>{value}</Text>
    </Row>
  );
}