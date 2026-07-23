/**
 * Auth state + token storage. Tokens are SENSITIVE, so both live in
 * expo-secure-store (hardware-backed keychain/keystore), never AsyncStorage.
 * The access token is also mirrored in memory for synchronous header attach.
 */
import axios from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import i18n from "./i18n";

import { API_BASE_URL, api, bindAuth, isNetworkError } from "./api-client";
import { registerForPush, unregisterPush } from "./push";
import { queryClient } from "./query-client";
import type { Me, TokenPair } from "./types";

const ACCESS_KEY = "ants.access";
const REFRESH_KEY = "ants.refresh";

let accessToken: string | null = null;
export const getAccessToken = () => accessToken;

async function persistTokens(pair: TokenPair) {
  accessToken = pair.access_token;
  await SecureStore.setItemAsync(ACCESS_KEY, pair.access_token);
  await SecureStore.setItemAsync(REFRESH_KEY, pair.refresh_token);
}

async function clearTokens() {
  accessToken = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Rotate the refresh token; returns the new access token. Used by the 401 interceptor. */
async function rotateRefresh(): Promise<string> {
  const refresh_token = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh_token) throw new Error("No refresh token");
  const { data } = await axios.post<TokenPair>(`${API_BASE_URL}/auth/refresh`, { refresh_token });
  await persistTokens(data);
  return data.access_token;
}

function syncLanguage(me: Me) {
  if (me.language && me.language !== i18n.language) {
    void i18n.changeLanguage(me.language);
  }
}

interface AuthState {
  ready: boolean;
  me: Me | null;
  onboarded: boolean;
  // New: true when the LAST attempt to resolve the session failed purely
  // from a connectivity problem (no response from the server at all) --
  // NOT from an invalid/expired token. Distinct from `!me`, which
  // previously was the ONLY signal the route gate had, and got hit by
  // BOTH "genuinely logged out" and "briefly offline" identically. A
  // stored token is left untouched while this is true -- nothing is
  // cleared just because the network hiccuped.
  connectionError: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  acceptInvite: (token: string, password: string, fullName?: string) => Promise<void>;
  markOnboarded: () => Promise<void>;
  signOut: () => void;
  // New: re-attempts resolving the session from whatever token is already
  // stored, without requiring the person to log in again. Powers the
  // no-internet screen's Retry button.
  retryConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const onboarded = !!me?.onboarding_completed_at;

  const signOut = useCallback(() => {
    api.post("/auth/logout").catch(() => undefined);
    unregisterPush().catch(() => undefined);
    void clearTokens();
    queryClient.clear();
    setMe(null);
    setConnectionError(false);
    router.replace("/(auth)/login");
  }, []);

  useEffect(() => {
    bindAuth({ getAccess: getAccessToken, refresh: rotateRefresh, signOut });
  }, [signOut]);

  /** Attempts to resolve the current session from whatever token is
   * already stored (or already in memory). Used both on cold start and
   * by the Retry button -- same logic, so "try again" behaves exactly
   * like "app just launched" would have. */
  const resolveSession = useCallback(async () => {
    try {
      const stored = accessToken ?? (await SecureStore.getItemAsync(ACCESS_KEY));
      if (!stored) {
        setConnectionError(false);
        return;
      }
      accessToken = stored;
      const { data } = await api.get<Me>("/me"); // 401 here triggers refresh rotation automatically
      setMe(data);
      setConnectionError(false);
      syncLanguage(data);
      registerForPush().catch(() => undefined);
    } catch (error) {
      if (isNetworkError(error)) {
        // Genuinely just offline/unreachable -- NOT a rejected session.
        // Leave any stored token exactly as-is; only surface the error
        // state so the UI can show "no internet, retry" instead of
        // silently signing the person out.
        setConnectionError(true);
        return;
      }
      // A real rejection (invalid/expired token, refresh itself failed,
      // etc.) -- this is the only case where clearing tokens is correct.
      setConnectionError(false);
      await clearTokens();
    }
  }, []);

  // Session restore on cold start.
  useEffect(() => {
    (async () => {
      await resolveSession();
      setReady(true);
    })();
  }, [resolveSession]);

  // Re-fetch /me and re-sync on every foreground -- catches both a
  // server-side language change and onboarding-completed state. Also
  // doubles as a natural retry point: if we came back from background
  // with connectionError still set, this gives it another shot.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") return;
      if (!meRef.current && !connectionError) return; // never logged in at all -- nothing to refresh
      resolveSession();
    });
    return () => sub.remove();
  }, [resolveSession, connectionError]);

  // New: auto-retry the instant real connectivity comes back, so most
  // people never even need to tap the Retry button -- it reappears
  // working on its own the moment their signal returns. The manual
  // button still exists for the case where NetInfo says "connected" but
  // the actual API path is still unreachable (e.g. captive portal Wi-Fi).
  useEffect(() => {
    if (!connectionError) return;
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) resolveSession();
    });
    return unsub;
  }, [connectionError, resolveSession]);

  const afterAuth = useCallback(async (pair: TokenPair) => {
    await persistTokens(pair);
    const { data } = await api.get<Me>("/me");
    if (data.role === "owner_admin") {
      await clearTokens();
      throw new Error("Owners use the web dashboard — this app is for employees and managers.");
    }
    setMe(data);
    setConnectionError(false);
    syncLanguage(data);
    registerForPush().catch(() => undefined);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<TokenPair>("/auth/login", { email, password });
    await afterAuth(data);
  }, [afterAuth]);

  const acceptInvite = useCallback(async (token: string, password: string, fullName?: string) => {
    const { data } = await api.post<TokenPair>("/auth/accept-invite", {
      token, password, full_name: fullName || null,
    });
    await afterAuth(data);
  }, [afterAuth]);

  const markOnboarded = useCallback(async () => {
    const { data } = await api.post<Me>("/me/onboarding-complete");
    setMe(data);
  }, []);

  const value = useMemo(
    () => ({ ready, me, onboarded, connectionError, signIn, acceptInvite, markOnboarded, signOut, retryConnection: resolveSession }),
    [ready, me, onboarded, connectionError, signIn, acceptInvite, markOnboarded, signOut, resolveSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}