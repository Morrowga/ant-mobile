import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { Button, Card, ErrorText, Screen, Title } from "@/components/ui";

const OPTIONS = [
  { label: "Less than 5h", hours: 4 },
  { label: "5–6 hours", hours: 5.5 },
  { label: "6–7 hours", hours: 6.5 },
  { label: "7–8 hours", hours: 7.5 },
  { label: "8+ hours", hours: 8.5 },
] as const;

/** Fired right at check-in only (see attendance_service.py's check_in()) --
 * mandatory, not a dismissable notification. Navigated to automatically
 * right after check-in succeeds, not dependent on tapping a push
 * notification. Swipe-to-dismiss is disabled (see _layout.tsx's
 * gestureEnabled: false) and the Android hardware back button is
 * swallowed below -- the only way out of this screen is answering. */
export default function SleepCheckin() {
  const { promptId } = useLocalSearchParams<{ promptId?: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true); // swallow back press
    return () => sub.remove();
  }, []);

  const submit = useMutation({
    mutationFn: (hours: number) =>
      api.post("/health/sleep", { hours, prompt_id: promptId ? Number(promptId) : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health"] });
      setDone(true);
      setTimeout(() => router.back(), 700);
    },
    onError: (e) => setError(errorDetail(e)),
  });

  if (done) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl">✓</Text>
          <Text className="mt-3 font-sansbold text-[16px] text-espresso">Logged!</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center">
        <Title>How many hours did you sleep last night?</Title>
        <Card className="mt-6 gap-2">
          {OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              label={opt.label}
              variant="outline"
              loading={submit.isPending && submit.variables === opt.hours}
              disabled={submit.isPending}
              onPress={() => submit.mutate(opt.hours)}
            />
          ))}
        </Card>
        {error && <ErrorText>{error}</ErrorText>}
        <Text className="mt-4 text-center font-sans text-xs text-faint">
          Only visible to you — never shared with your manager or company. Answering this is required to continue.
        </Text>
      </View>
    </Screen>
  );
}