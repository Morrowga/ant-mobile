/**
 * Auth state + token storage. Tokens are SENSITIVE, so both live in
 * expo-secure-store (hardware-backed keychain/keystore), never AsyncStorage.
 * The access token is also mirrored in memory for synchronous header attach.
 */
import axios from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { API_BASE_URL, api, bindAuth } from "./api-client";
import { registerForPush, unregisterPush } from "./push";
import { queryClient } from "./query-client";
import type { Me, TokenPair } from "./types";

const ACCESS_KEY = "ants.access";
const REFRESH_KEY = "ants.refresh";
const ONBOARDED_KEY = "ants.onboarded"; // consent flow completed on this device

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

interface AuthState {
  ready: boolean;
  me: Me | null;
  onboarded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  acceptInvite: (token: string, password: string, fullName?: string) => Promise<void>;
  markOnboarded: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  const signOut = useCallback(() => {
    api.post("/auth/logout").catch(() => undefined);
    unregisterPush().catch(() => undefined);
    void clearTokens();
    queryClient.clear();
    setMe(null);
    router.replace("/(auth)/login");
  }, []);

  // Give the API client its token hooks once.
  useEffect(() => {
    bindAuth({ getAccess: getAccessToken, refresh: rotateRefresh, signOut });
  }, [signOut]);

  // Session restore on cold start.
  useEffect(() => {
    (async () => {
      try {
        const [stored, onboardFlag] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_KEY),
          SecureStore.getItemAsync(ONBOARDED_KEY),
        ]);
        setOnboarded(onboardFlag === "1");
        if (stored) {
          accessToken = stored;
          const { data } = await api.get<Me>("/me"); // 401 here triggers refresh rotation automatically
          setMe(data);
          registerForPush().catch(() => undefined);
        }
      } catch {
        await clearTokens();
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const afterAuth = useCallback(async (pair: TokenPair) => {
    await persistTokens(pair);
    const { data } = await api.get<Me>("/me");
    if (data.role === "owner_admin") {
      await clearTokens();
      throw new Error("Owners use the web dashboard — this app is for employees and managers.");
    }
    setMe(data);
    registerForPush().catch(() => undefined); // rule 8: FCM registration on login
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
    await SecureStore.setItemAsync(ONBOARDED_KEY, "1");
    setOnboarded(true);
  }, []);

  const value = useMemo(
    () => ({ ready, me, onboarded, signIn, acceptInvite, markOnboarded, signOut }),
    [ready, me, onboarded, signIn, acceptInvite, markOnboarded, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
