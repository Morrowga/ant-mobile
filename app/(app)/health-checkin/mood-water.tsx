import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplet, Smile } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { Button, ErrorText, Screen } from "@/components/ui";

const WATER_OPTIONS = [
  { ml: 100, label: "100ml" },
  { ml: 200, label: "200ml" },
  { ml: 300, label: "300ml" },
  { ml: 500, label: "500ml" },
];

const MOOD_OPTIONS = [
  { value: 5, emoji: "😄", label: "Great" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 1, emoji: "😣", label: "Rough" },
] as const;

// Consistent card shadow used across both question cards -- gives real
// elevation/depth instead of flat borderless blocks on a plain background.
const CARD_SHADOW = {
  shadowColor: "#2b2a2a",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

/** Fired every ~2h during an active session (see health_reminders.py). One
 * combined survey -- both questions answered here, one Submit at the end. */
export default function MoodWaterCheckin() {
  const { promptId } = useLocalSearchParams<{ promptId?: string }>();
  const promptIdNum = promptId ? Number(promptId) : undefined;
  const qc = useQueryClient();
  const [waterMl, setWaterMl] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      await api.post("/health/water", { ml: waterMl, prompt_id: promptIdNum });
      await api.post("/health/mood", { mood, prompt_id: promptIdNum });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health"] });
      setDone(true);
      setTimeout(() => router.back(), 800);
    },
    onError: (e) => setError(errorDetail(e)),
  });

  if (done) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center bg-cream">
          <View
            className="h-20 w-20 items-center justify-center rounded-full bg-latte-deep"
            style={CARD_SHADOW}
          >
            <Text className="text-4xl">✓</Text>
          </View>
          <Text className="mt-5 font-display text-xl text-espresso">Thanks — logged!</Text>
        </View>
      </Screen>
    );
  }

  const canSubmit = waterMl !== null && mood !== null;

  return (
    <Screen>
      <View className="bg-cream pb-8 pt-3">
        {/* Header, with a small copper accent line under the title */}
        <View className="items-center">
          <Text className="font-display text-[22px] text-espresso">Quick check-in</Text>
          <View className="mt-2 h-[3px] w-10 rounded-full bg-copper" />
          <Text className="mt-3 text-center font-sans text-[13px] text-faint">
            Two quick questions — takes a few seconds.
          </Text>
        </View>

        {/* Question 1 -- water */}
        <View className="mt-7 rounded-3xl border border-line/70 bg-paper p-5" style={CARD_SHADOW}>
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#eaf2f3]">
              <Droplet size={18} color="#3d7a85" fill="#3d7a85" />
            </View>
            <Text className="flex-1 font-sansbold text-[15px] text-ink">How much water have you had?</Text>
          </View>
          <View className="mt-4 flex-row flex-wrap gap-2.5">
            {WATER_OPTIONS.map((opt) => {
              const selected = waterMl === opt.ml;
              return (
                <Pressable
                  key={opt.ml}
                  onPress={() => setWaterMl(opt.ml)}
                  className={`min-w-[70px] flex-1 items-center rounded-2xl border py-3.5 ${
                    selected ? "border-espresso bg-espresso" : "border-line bg-cream"
                  }`}
                >
                  <Text className={`font-sansbold text-[14px] ${selected ? "text-cream" : "text-ink"}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Decorative divider between the two questions */}
        <View className="my-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-line" />
          <View className="h-1.5 w-1.5 rounded-full bg-copper/60" />
          <View className="h-px flex-1 bg-line" />
        </View>

        {/* Question 2 -- mood */}
        <View className="rounded-3xl border border-line/70 bg-paper p-5" style={CARD_SHADOW}>
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#f3e9de]">
              <Smile size={18} color="#a8672f" />
            </View>
            <Text className="flex-1 font-sansbold text-[15px] text-ink">How are you feeling right now?</Text>
          </View>
          <View className="mt-5 flex-row justify-between">
            {MOOD_OPTIONS.map((opt) => {
              const selected = mood === opt.value;
              return (
                <Pressable key={opt.value} onPress={() => setMood(opt.value)} className="items-center gap-1.5">
                  <View
                    className={`h-14 w-14 items-center justify-center rounded-full ${
                      selected ? "bg-latte-deep" : "bg-cream"
                    }`}
                    style={selected ? { ...CARD_SHADOW, shadowOpacity: 0.12 } : undefined}
                  >
                    <Text className="text-[26px]">{opt.emoji}</Text>
                  </View>
                  <Text className={`font-sans text-[11px] ${selected ? "font-sansbold text-espresso" : "text-faint"}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error && <ErrorText>{error}</ErrorText>}

        <Button
          label="Submit"
          variant="dark"
          className="mt-8"
          disabled={!canSubmit}
          loading={submit.isPending}
          onPress={() => submit.mutate()}
        />
      </View>
    </Screen>
  );
}