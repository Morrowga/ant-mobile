/**
 * Single API client for the whole app — mirrors the dashboard's
 * src/lib/api-client.ts pattern. Screens never call axios directly.
 * - attaches the access token (held in memory; persisted via SecureStore)
 * - 401 → one refresh-token rotation, replay, else sign out
 * - 402 → PlanGateError. Since the backend applies RequireActivePlan to every
 *   feature router, a lapsed COMPANY subscription surfaces here too — the UI
 *   shows "ask your admin", because employees can't fix billing from this app.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class PlanGateError extends Error {
  readonly planGated = true;
  constructor(public detail: string) { super(detail); }
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 });

// Wired by AuthProvider at startup (avoids a require cycle with auth.tsx).
type TokenHooks = {
  getAccess: () => string | null;
  refresh: () => Promise<string>; // rotates + persists, returns new access token
  signOut: () => void;
};
let hooks: TokenHooks | null = null;
export function bindAuth(h: TokenHooks) { hooks = h; }

api.interceptors.request.use((config) => {
  const token = hooks?.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail?: unknown }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status === 402) {
      throw new PlanGateError(errorDetail(error));
    }
    if (error.response?.status === 401 && original && !original._retried
        && hooks && !original.url?.includes("/auth/")) {
      original._retried = true;
      try {
        refreshing = refreshing ?? hooks.refresh();
        const token = await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        refreshing = null;
        hooks.signOut();
      }
    }
    throw error;
  },
);


export function isPlanGated(error: unknown): error is PlanGateError {
  return error instanceof PlanGateError;
}

/** True for connectivity-level failures (no response at all) — the offline queue trigger. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/** FastAPI `detail` can be a string OR an array of validation objects (422). */
export function errorDetail(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : String(d))).join("; ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    // No response at all covers BOTH "your device has no connectivity" AND
    // "the server is genuinely unreachable right now" (mid-restart, crashed,
    // etc.) -- the wording shouldn't specifically blame the user's device
    // for a condition that could just as easily be the server's fault.
    if (!error.response) return "Couldn't reach the server — this will sync once connection is back.";
  }
  return error instanceof Error ? error.message : "Something went wrong";
}