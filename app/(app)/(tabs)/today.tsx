/**
 * The Today screen — the app's core loop. Check in → (if outside desk:
 * "working outside today?" question) → (sleep hours question) → work with
 * a VISIBLE tracking indicator → check out (tracking hard-stops).
 * Check-in/out survive connectivity drops via the offline queue (rule 7).
 *
 * Now also the home for: live clock, late/on-time status, countdown to
 * shift start/end, break start/end with a running timer, and a "This
 * week" summary (moved here from the Reports screen).
 *
 * No selfie/camera step -- removed entirely, was never actually needed.
 * The two post-check-in questions (working outside, sleep hours) are
 * strictly SEQUENTIAL: the work-outside dialog must fully close (confirm
 * OR cancel) before the sleep-hours screen ever opens. Never both at once.
 *
 * "New report" button removed -- report submission now happens through
 * the checkout flow (Today redirects to the report form automatically if
 * checkout is attempted without one), so a separate standalone entry
 * point was redundant.
 *
 * New: job_type branching. full_time keeps every existing behavior below
 * completely unchanged -- shift clock, early-check-in block, shift-ended
 * block, late/on-time badge. part_time hides all of that (no fixed shift
 * to compare against) and shows a simpler flexible-hours message instead;
 * the actual one-check-in-per-day enforcement lives entirely server-side
 * (AttendanceService.check_in()), this only adjusts what's DISPLAYED.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useFocusEffect } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { getCurrentPosition, isTracking, startTracking, stopTracking } from "@/lib/location";
import { runOrQueue, subscribeQueue, type QueuedAction } from "@/lib/offline-queue";
import type { AttendanceStatus, Notification, Recognition, Report } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, ErrorText, Row, Screen, SectionTitle, Subtitle, Title } from "@/components/ui";
import { PresenceCheckModal } from "@/components/presence-check-modal";

interface ShiftStatus {
  shift_start_local: string;
  shift_end_local: string;
  employee_timezone: string;
  working_hours_mode: "company_timezone" | "local_wall_clock";
  is_late: boolean | null;
  minutes_late: number | null;
  minutes_until_start: number | null;
  shift_has_ended: boolean;
  minutes_until_end: number | null;
  job_type: "full_time" | "part_time";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtMinutes(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
}

/** "Asia/Ho_Chi_Minh" -> "Ho Chi Minh". Takes just the city part after the
 * last slash and swaps underscores for spaces -- works for any IANA
 * timezone name, not just this specific one. */
function fmtTimezone(tz: string): string {
  const city = tz.split("/").pop() ?? tz;
  return city.replaceAll("_", " ");
}

export default function Today() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["attendance", "status"],
    queryFn: async () => (await api.get<AttendanceStatus>("/attendance/me/status")).data,
    refetchInterval: 60_000,
  });
  const shift = useQuery({
    queryKey: ["attendance", "shift-status"],
    queryFn: async () => (await api.get<ShiftStatus>("/attendance/me/shift-status")).data,
    refetchInterval: 60_000,
  });
  const notifications = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: async () => (await api.get<Notification[]>("/notifications/me")).data,
    refetchInterval: 60_000,
  });
  const reports = useQuery({
    queryKey: ["reports", "me"],
    queryFn: async () => (await api.get<Report[]>("/reports/me")).data,
  });
  const kudos = useQuery({
    queryKey: ["recognitions", "me"],
    queryFn: async () => (await api.get<Recognition[]>("/recognitions/me")).data,
  });
  const unreadCount = notifications.data?.filter((n) => !n.read_at).length ?? 0;

  const isRefreshing = status.isFetching || shift.isFetching || notifications.isFetching
    || reports.isFetching || kudos.isFetching;
  const handleRefresh = () => {
    status.refetch();
    shift.refetch();
    notifications.refetch();
    reports.refetch();
    kudos.refetch();
  };

  // New: part-time has no shift-time restrictions at all (see
  // AttendanceService.check_in()) -- these are forced false regardless of
  // the raw shift numbers, which are still computed server-side as a
  // fallback but don't apply to part-time employees.
  const isPartTime = shift.data?.job_type === "part_time";

  // Matches the backend's own 15-minute early-check-in window -- disables
  // the button proactively instead of just letting the tap fail with a
  // rejected request.
  const tooEarlyToCheckIn =
    !isPartTime &&
    shift.data?.minutes_until_start !== null &&
    shift.data?.minutes_until_start !== undefined &&
    shift.data.minutes_until_start > 15;
  // New: today's whole shift window has already closed -- checking in
  // hours after the shift ended doesn't correspond to any real shift left
  // to work, so this blocks it entirely, same as the backend's own check.
  // Doesn't apply to part-time.
  const shiftEnded = !isPartTime && shift.data?.shift_has_ended === true;

  // Expo Router keeps tab screens mounted in the background when switching
  // tabs (not destroyed/remounted), so useQuery's normal refetch-on-mount
  // behavior never fires just from coming back to this tab. Explicitly
  // refetch on focus instead.
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    }, [qc])
  );

  // Live clock -- ticks every second, purely client-side display. Also
  // drives the running break timer below (both need a per-second tick).
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [tracking, setTracking] = useState(false);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workOutsidePromptOpen, setWorkOutsidePromptOpen] = useState(false);
  // Holds the sleep prompt id between "work-outside dialog closes" and
  // "sleep screen opens" -- null when there's nothing pending.
  const [pendingSleepPromptId, setPendingSleepPromptId] = useState<string | null>(null);

  useEffect(() => subscribeQueue(setQueue), []);
  useEffect(() => { void isTracking().then(setTracking); }, [status.data?.checked_in]);

  const goToSleepCheckinIfPending = (sleepPromptId: string | null) => {
    if (sleepPromptId) {
      router.push({ pathname: "/(app)/health-checkin/sleep", params: { promptId: sleepPromptId } });
    }
  };

  const checkIn = useMutation({
    mutationFn: async () => {
      setError(null); setNotice(null);
      let coords: { lat: number; lng: number } | null = null;
      try {
        const position = await getCurrentPosition();
        coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch { /* no location permission — check in without coordinates */ }
      const body = coords ?? {};
      const { queued, result } = await runOrQueue(
        { kind: "check-in", path: "/attendance/check-in", body },
        () => api.post("/attendance/check-in", body),
      );
      if (queued) {
        setNotice("You're offline — check-in saved and will sync automatically.");
      } else {
        const started = await startTracking();
        setTracking(started);
      }
      return { result, queued };
    },
    onSuccess: ({ result: response, queued }) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });

      const lateMinutes = response?.data?.late_minutes;
      if (typeof lateMinutes === "number" && lateMinutes > 0) {
        setNotice(`You checked in ${fmtMinutes(lateMinutes)} late.`);
      }
      if (queued) return;

      const sleepPromptId = response?.data?.sleep_prompt_id ? String(response.data.sleep_prompt_id) : null;

      // Strictly sequential: if outside desk, ask that FIRST and hold the
      // sleep prompt until it's actually answered. Otherwise go straight
      // to the sleep question. Never both open at once.
      if (response?.data?.checked_in_outside_desk) {
        setPendingSleepPromptId(sleepPromptId);
        setWorkOutsidePromptOpen(true);
      } else {
        goToSleepCheckinIfPending(sleepPromptId);
      }
    },
    onError: (e) => setError(errorDetail(e)),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      setError(null); setNotice(null);
      await stopTracking();
      setTracking(false);
      const { queued, result } = await runOrQueue(
        { kind: "check-out", path: "/attendance/check-out", body: {} },
        () => api.post("/attendance/check-out"),
      );
      if (queued) setNotice("You're offline — check-out saved and will sync automatically.");
      return result;
    },
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      const earlyMinutes = response?.data?.early_checkout_minutes;
      if (typeof earlyMinutes === "number" && earlyMinutes > 0) {
        setNotice(`You checked out ${fmtMinutes(earlyMinutes)} early.`);
      }
    },
    onError: (e) => {
      const detail = errorDetail(e);
      if (detail.includes("Submit today's report before checking out")) {
        void startTracking().then(setTracking); // undo the optimistic stopTracking() above
        router.push({ pathname: "/(app)/report/new", params: { forCheckout: "true" } });
        return;
      }
      setError(detail);
    },
  });

  const workOutside = useMutation({
    mutationFn: (reason: string) => api.post("/attendance/work-outside", { reason }),
    onSuccess: async () => {
      setNotice("Marked as working outside today — no away-from-desk alerts.");
      setWorkOutsidePromptOpen(false);
      await stopTracking();
      setTracking(false);
      qc.invalidateQueries({ queryKey: ["attendance", "status"] });
      // Now that this dialog is fully done, move on to the sleep question.
      goToSleepCheckinIfPending(pendingSleepPromptId);
      setPendingSleepPromptId(null);
    },
    onError: (e) => setError(errorDetail(e)),
  });

  const cancelWorkOutside = useMutation({
    mutationFn: () => api.post("/attendance/work-outside/cancel"),
    onSuccess: async () => {
      if (status.data?.checked_in) {
        const started = await startTracking();
        setTracking(started);
      }
      qc.invalidateQueries({ queryKey: ["attendance", "status"] });
    },
    onError: (e) => setError(errorDetail(e)),
  });

  const startBreak = useMutation({
    mutationFn: () => api.post("/attendance/break/start"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", "status"] }),
    onError: (e) => setError(errorDetail(e)),
  });
  const endBreak = useMutation({
    mutationFn: () => api.post("/attendance/break/end"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", "status"] }),
    onError: (e) => setError(errorDetail(e)),
  });

  return (
    <Screen refreshing={isRefreshing} onRefresh={handleRefresh}>
      <Row className="items-start justify-between">
        <View>
          <Title>Hi{me?.full_name ? `, ${me.full_name.split(" ")[0]}` : ""}</Title>
          <Subtitle>{new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</Subtitle>
        </View>
        <Pressable onPress={() => router.push("/(app)/notifications")} className="relative p-1">
          <Bell size={24} color="#3d2c1f" />
          {unreadCount > 0 && (
            <View className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-cream bg-red-500" />
          )}
        </Pressable>
      </Row>

      <Card className="mt-4 items-center py-6">
        <Text className="font-display text-[40px] text-espresso tabular-nums">
          {now.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </Text>
        <QueryBoundary query={shift}>
          {(s) => s.job_type === "part_time" ? (
            <Text className="mt-2 font-sans text-xs text-faint">Flexible hours — no fixed shift window</Text>
          ) : (
            <View className="mt-2 items-center">
              <Text className="font-sans text-xs text-faint">
                Shift: {s.shift_start_local} – {s.shift_end_local} ({fmtTimezone(s.employee_timezone)})
              </Text>
              {status.data?.checked_in ? (
                s.minutes_until_end !== null && s.minutes_until_end > 0 && (
                  <Text className="mt-1 font-sansmed text-[13px] text-ink">
                    {fmtMinutes(s.minutes_until_end)} left in your shift
                  </Text>
                )
              ) : (
                s.minutes_until_start !== null && s.minutes_until_start > 0 && (
                  <Text className="mt-1 font-sansmed text-[13px] text-ink">
                    Shift starts in {fmtMinutes(s.minutes_until_start)}
                  </Text>
                )
              )}
            </View>
          )}
        </QueryBoundary>
      </Card>

      {queue.length > 0 && (
        <Card className="mt-4 bg-latte/40">
          <Text className="font-sansmed text-[13px] text-espresso">
            {queue.length} action{queue.length > 1 ? "s" : ""} waiting to sync — they'll send automatically when you're back online.
          </Text>
        </Card>
      )}

      <QueryBoundary query={status}>
        {(data) => (
          <>
            <Card className="mt-4">
              {data.checked_in ? (
                <>
                  <Row className="justify-between">
                    <Text className="font-display text-xl text-espresso">On the clock</Text>
                    <OnDutyDot />
                  </Row>
                  <Text className="mt-1 font-sans text-[13px] text-faint">
                    since {data.check_in_at ? new Date(data.check_in_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) : "…"}
                  </Text>
                  <Row className="mt-3 flex-wrap gap-2">
                    {!isPartTime && shift.data?.is_late ? (
                      <Badge label={`${fmtMinutes(shift.data.minutes_late ?? 0)} late`} tone="bad" />
                    ) : !isPartTime && shift.data?.is_late === false ? (
                      <Badge label="on time" tone="good" />
                    ) : null}
                    <Badge label={tracking ? "location tracking active" : "location tracking off"}
                      tone={tracking ? "warn" : "neutral"} />
                    {data.checked_in_outside_desk && <Badge label="outside desk area" tone="warn" />}
                  </Row>
                  <Button label="Check out" variant="primary" className="mt-4"
                    loading={checkOut.isPending} onPress={() => checkOut.mutate()} />
                </>
              ) : (
                <>
                  <Text className="font-display text-xl text-ink">Off the clock</Text>
                  <Text className="mt-1 font-sans text-[13px] text-faint">
                    {data.report_submitted_today
                      ? "Today's report is already submitted — see you tomorrow."
                      : isPartTime
                      ? `Checking in starts your attendance session${tracking ? "" : " — location is only recorded while you're on it"}. You can check in once per day.`
                      : shiftEnded
                      ? "Today's shift has already ended — check-in is no longer available for today."
                      : tooEarlyToCheckIn
                      ? `Check-in opens 15 minutes before your shift — ${fmtMinutes((shift.data?.minutes_until_start ?? 0) - 15)} to go.`
                      : `Checking in starts your attendance session${tracking ? "" : " — location is only recorded while you're on it"}.`}
                  </Text>
                  <Button label="Check in" variant="dark" className="mt-4"
                    disabled={data.report_submitted_today || tooEarlyToCheckIn || shiftEnded}
                    loading={checkIn.isPending} onPress={() => checkIn.mutate()} />
                </>
              )}
            </Card>

            {data.checked_in && (
              <Card className="mt-3">
                {data.on_break ? (
                  <>
                    <Row className="justify-between">
                      <Text className="font-display text-lg text-ink">On break</Text>
                      <Badge label="on break" tone="warn" />
                    </Row>
                    <Text className="mt-1 font-display text-2xl text-ink tabular-nums">
                      {data.break_started_at ? fmtElapsed(now, new Date(data.break_started_at)) : "00:00"}
                    </Text>
                    <Button label="End break" variant="dark" className="mt-3"
                      loading={endBreak.isPending} onPress={() => endBreak.mutate()} />
                  </>
                ) : (
                  <>
                    <Row className="justify-between">
                      <Text className="font-sansmed text-[14px] text-ink">Break time</Text>
                      <Text className="font-sans text-[13px] text-faint">
                        {data.total_break_minutes_today > 0 ? `${fmtMinutes(data.total_break_minutes_today)} today` : "none yet today"}
                      </Text>
                    </Row>
                    <Button label="Start break" variant="outline" className="mt-3"
                      loading={startBreak.isPending} onPress={() => startBreak.mutate()} />
                  </>
                )}
              </Card>
            )}
          </>
        )}
      </QueryBoundary>

      {notice && (
        <Card className="mt-3 flex-row items-center justify-between bg-[#dcebd9]">
          <Text className="flex-1 font-sans text-[13px] text-[#2f5d33]">{notice}</Text>
          <Pressable onPress={() => setNotice(null)} className="pl-3">
            <Text className="font-sansbold text-[13px] text-[#2f5d33]">✕</Text>
          </Pressable>
        </Card>
      )}
      {error && <ErrorText>{error}</ErrorText>}

      <Row className="mt-4">
        {status.data?.working_outside_today ? (
          <Button label="Back to desk" variant="dark" className="flex-1"
            loading={cancelWorkOutside.isPending} onPress={() => cancelWorkOutside.mutate()} />
        ) : status.data?.checked_in && status.data?.work_outside_available !== false && !status.data?.report_submitted_today ? (
          <Button label="Working outside today" variant="outline" className="flex-1"
            onPress={() => setWorkOutsidePromptOpen(true)} />
        ) : null}
      </Row>

      <View className="mt-6 flex-row flex-wrap gap-2">
        <QuickLink href="/(app)/leave" label="Leave" />
        <QuickLink href="/(app)/overtime" label="Overtime" />
        <QuickLink href="/(app)/attendance-history" label="History" />
        <QuickLink href="/(app)/recognitions" label="Kudos" />
      </View>

      {/* Moved here from the Reports screen -- this is where "how's my
          week going" naturally belongs, right on the home screen. */}
      <WeekSummary reports={reports.data ?? []} kudosCount={kudos.data?.length ?? 0} />

      <WorkOutsideModal
        open={workOutsidePromptOpen}
        onClose={() => {
          setWorkOutsidePromptOpen(false);
          // Cancelled, not confirmed -- still move on to the sleep question.
          goToSleepCheckinIfPending(pendingSleepPromptId);
          setPendingSleepPromptId(null);
        }}
        onConfirm={(reason) => workOutside.mutate(reason)}
        loading={workOutside.isPending}
        error={workOutside.isError ? errorDetail(workOutside.error) : null}
      />

      {/* Presence check -- based on real polled status
          (pending_presence_check_id from GET /attendance/me/status, same
          query this screen already polls every 60s), not a notification
          tap event. Reappears on every poll/app relaunch until actually
          answered. Tapping the push notification for this type just
          navigates here (see lib/push.ts) -- the dialog shows itself. */}
      {status.data?.pending_presence_check_id && (
        <PresenceCheckModal
          promptId={String(status.data.pending_presence_check_id)}
          onAnswered={() => qc.invalidateQueries({ queryKey: ["attendance", "status"] })}
        />
      )}
    </Screen>
  );
}

/** Moved from Reports.tsx verbatim -- same client-side computation from
 * already-fetched data, no new backend endpoint needed. */
function WeekSummary({ reports, kudosCount }: { reports: Report[]; kudosCount: number }) {
  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY_MS;
    const thisWeek = reports.filter((r) => new Date(r.report_date).getTime() >= weekAgo);
    const hoursThisWeek = thisWeek.reduce((sum, r) => sum + r.hours, 0);
    return {
      reportsThisWeek: thisWeek.length,
      hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
      avgHoursPerDay: thisWeek.length ? Math.round((hoursThisWeek / thisWeek.length) * 10) / 10 : 0,
    };
  }, [reports]);

  return (
    <>
      <SectionTitle>This week</SectionTitle>
      <View className="gap-2">
        <Stat label="Reports submitted" value={String(stats.reportsThisWeek)} />
        <Stat label="Hours logged" value={`${stats.hoursThisWeek}h`} />
        <Stat label="Average per day" value={`${stats.avgHoursPerDay}h`} />
        <Stat label="Kudos received" value={String(kudosCount)} />
      </View>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-row items-center justify-between py-3">
      <Text className="font-sans text-[14px] text-faint">{label}</Text>
      <Text className="font-display text-[16px] text-ink">{value}</Text>
    </Card>
  );
}

function fmtElapsed(now: Date, start: Date): string {
  const totalSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="rounded-full border border-line bg-paper px-4 py-2 active:bg-latte/40">
        <Text className="font-sansmed text-[13px] text-espresso">{label}</Text>
      </Pressable>
    </Link>
  );
}

function OnDutyDot() {
  return <View className="h-2.5 w-2.5 rounded-full bg-[#8fbd8a]" />;
}

function WorkOutsideModal({ open, onClose, onConfirm, loading, error }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; loading: boolean; error: string | null;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-ink/40 px-6">
        <View className="w-full rounded-2xl bg-paper p-5">
          <Text className="font-display text-lg text-ink">Are you working outside today?</Text>
          <Text className="mt-1 font-sans text-[13px] text-faint">
            Add a quick reason so your manager knows why — this turns off away-from-desk alerts for today.
          </Text>
          <TextInput
            value={reason} onChangeText={setReason} placeholder="e.g. Client visit, working from home"
            placeholderTextColor="#8a8580" multiline
            className="mt-3 h-20 rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink"
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Row className="mt-4 gap-2">
            <Button label="No" variant="outline" className="flex-1" onPress={onClose} />
            <Button label="Yes, confirm" variant="dark" className="flex-1"
              disabled={!reason.trim()} loading={loading} onPress={() => onConfirm(reason.trim())} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}