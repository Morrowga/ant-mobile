/**
 * Offline queueing (rule 7) for the field-work critical writes: check-in,
 * check-out, and report submission. When a mutation fails with a
 * CONNECTIVITY error (no HTTP response at all), the action is stored in
 * AsyncStorage and replayed in order on reconnect / next launch.
 * Server-side rejections (4xx/5xx) are NOT queued — those are real answers.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import { api, isNetworkError } from "./api-client";
import { queryClient } from "./query-client";

const QUEUE_KEY = "ants.offline-queue";

export interface QueuedAction {
  id: string;
  kind: "check-in" | "check-out" | "report";
  path: string;
  body: unknown;
  queued_at: string;
}

type Listener = (queue: QueuedAction[]) => void;
const listeners = new Set<Listener>();
let flushing = false;

async function read(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
}

async function write(queue: QueuedAction[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  listeners.forEach((fn) => fn(queue));
}

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  void read().then(fn);
  return () => listeners.delete(fn);
}

export async function enqueue(action: Omit<QueuedAction, "id" | "queued_at">) {
  const queue = await read();
  queue.push({ ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, queued_at: new Date().toISOString() });
  await write(queue);
}

/**
 * Run `fn`; if it fails purely from connectivity, queue it for later and
 * resolve as { queued: true } so the UI can say "saved, will sync".
 * `result` carries fn's actual return value through when it succeeds
 * immediately (not queued) -- callers that need the real API response
 * (e.g. reading a field back to decide whether to show a follow-up prompt)
 * can read it; callers that don't care can ignore it, same as before.
 */
export async function runOrQueue<T>(
  action: Omit<QueuedAction, "id" | "queued_at">,
  fn: () => Promise<T>,
): Promise<{ queued: boolean; result?: T }> {
  try {
    const result = await fn();
    return { queued: false, result };
  } catch (error) {
    if (isNetworkError(error)) {
      await enqueue(action);
      return { queued: true };
    }
    throw error;
  }
}

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let queue = await read();
    while (queue.length > 0) {
      const [head, ...rest] = queue;
      try {
        await api.post(head.path, head.body);
      } catch (error) {
        if (isNetworkError(error)) return; // still offline — try again on next reconnect
        // Server rejected it (e.g. 409 already checked in) — drop it and move on.
      }
      queue = rest;
      await write(queue);
    }
    void queryClient.invalidateQueries();
  } finally {
    flushing = false;
  }
}

/** Call once at app start: flush now and on every reconnect. */
export function startQueueSync(): () => void {
  void flushQueue();
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) void flushQueue();
  });
  return unsub;
}