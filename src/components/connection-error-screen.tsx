import NetInfo from "@react-native-community/netinfo";
import { WifiOff } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button, Screen } from "@/components/ui";

/** Full-screen block shown whenever the device has no connection at all --
 *  both at cold-start (no session resolvable yet) AND mid-session (see
 *  app/(app)/_layout.tsx, which now renders this instead of the normal
 *  Stack whenever useIsConnected() is false). Auto-clears the moment
 *  NetInfo reports a real reconnect; the Retry button forces an immediate
 *  re-check rather than waiting for the next passive NetInfo event, for
 *  the case where the OS hasn't noticed the change yet on its own. */
export function ConnectionErrorScreen({ onRetry, retrying }: { onRetry?: () => void; retrying?: boolean } = {}) {
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    if (onRetry) return onRetry();
    setChecking(true);
    await NetInfo.fetch();
    setChecking(false);
  };

  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center px-8">
        <WifiOff size={48} color="#8a8580" />
        <Text className="mt-4 text-center font-display text-lg text-ink">No internet connection</Text>
        <Text className="mt-2 text-center font-sans text-sm text-faint">
          We couldn't reach the server. Check your connection and try again.
        </Text>
        <Button
          label={retrying || checking ? "Retrying…" : "Retry"}
          variant="dark" className="mt-6 w-full"
          loading={retrying || checking}
          onPress={handleRetry}
        />
      </View>
    </Screen>
  );
}