/**
 * Presence heartbeat (rule 9): POST /presence/heartbeat periodically while
 * the app is FOREGROUNDED, so the backend routes pushes to mobile when this
 * app is the active surface. Stops when backgrounded.
 */
import { AppState, type AppStateStatus } from "react-native";

import { api } from "./api-client";

const HEARTBEAT_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

function beat(state: string) {
  api.post("/presence/heartbeat", { platform: "mobile", app_state: state }).catch(() => undefined);
}

export function startPresence() {
  stopPresence();
  beat("active");
  timer = setInterval(() => beat("active"), HEARTBEAT_MS);
  appStateSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") {
      if (!timer) timer = setInterval(() => beat("active"), HEARTBEAT_MS);
      beat("active");
    } else {
      if (timer) { clearInterval(timer); timer = null; }
      beat("background");
    }
  });
}

export function stopPresence() {
  if (timer) { clearInterval(timer); timer = null; }
  appStateSub?.remove();
  appStateSub = null;
}
