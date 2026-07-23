/**
 * Single source of truth for "are we online" across the whole app --
 * used by OfflineBanner (shown on every screen) and by AuthProvider's
 * retry logic. Wraps NetInfo (already a dependency, already used by
 * offline-queue.ts) so there's exactly one listener subscription pattern
 * instead of every screen/component setting up its own.
 */
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useIsConnected(): boolean {
  const [connected, setConnected] = useState(true); // optimistic default -- avoids a flash of "offline" on first render before NetInfo reports in

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // isConnected can be null briefly on some platforms while NetInfo is
      // still determining state -- treat null as "assume connected" rather
      // than flashing the banner on every cold start.
      setConnected(state.isConnected !== false);
    });
    return unsub;
  }, []);

  return connected;
}