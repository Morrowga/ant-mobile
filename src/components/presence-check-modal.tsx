import { useMutation } from "@tanstack/react-query";
import { Modal, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { Button, ErrorText } from "@/components/ui";

/** Blocking modal -- no backdrop dismiss, no hardware back button dismiss
 * (onRequestClose intentionally does nothing), only way out is answering
 * Yes or No. Shown from Today based on a real polled status field
 * (pending_presence_check_id), not from a notification tap, so it
 * correctly reappears on app relaunch until actually answered.
 *
 * Buttons are stacked vertically, not side-by-side -- "No, not right now"
 * is longer text than "Yes, I'm here", and splitting the width in half
 * with flex-1 caused "now" to wrap onto its own line. Full-width stacked
 * buttons avoid that regardless of label length. */
export function PresenceCheckModal({ promptId, onAnswered }: { promptId: string; onAnswered: () => void }) {
  const respond = useMutation({
    mutationFn: (response: "yes" | "no") =>
      api.post(`/attendance/presence-check/${promptId}/respond`, { response }),
    onSuccess: onAnswered,
  });

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => { /* not dismissable */ }}>
      <View className="flex-1 items-center justify-center bg-ink/50 px-6">
        <View className="w-full rounded-2xl bg-paper p-5">
          <Text className="font-display text-lg text-ink">Are you there?</Text>
          <Text className="mt-1 font-sans text-[13px] text-faint">
            Your manager wants to quickly confirm you're okay. Answer honestly — this only affects
            whether a short deduction applies, nothing more.
          </Text>
          {respond.isError && <ErrorText>{errorDetail(respond.error)}</ErrorText>}
          <View className="mt-4 gap-2">
            <Button
              label={respond.isPending && respond.variables === "yes" ? "Sending…" : "Yes, I'm here"}
              variant="dark"
              loading={respond.isPending && respond.variables === "yes"}
              disabled={respond.isPending}
              onPress={() => respond.mutate("yes")}
            />
            <Button
              label={respond.isPending && respond.variables === "no" ? "Sending…" : "No, not right now"}
              variant="outline"
              loading={respond.isPending && respond.variables === "no"}
              disabled={respond.isPending}
              onPress={() => respond.mutate("no")}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}