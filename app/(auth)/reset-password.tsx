import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, errorDetail } from "@/lib/api-client";
import { Button, ErrorText, Field } from "@/components/ui";

/** Deep link target: ants://reset-password?token=... (backend gap — see README). */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setBusy(true); setError(null);
    try {
      await api.post("/auth/reset-password", { token: token.trim(), password });
      router.replace("/(auth)/login");
    } catch (e) {
      setError(errorDetail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-espresso">
      <View className="flex-1 justify-center px-6">
        <View className="rounded-2xl bg-paper p-5">
          <Text className="mb-4 font-display text-xl text-ink">Choose a new password</Text>
          <Field label="Reset code" autoCapitalize="none" value={token} onChangeText={setToken} />
          <Field label="New password" secureTextEntry value={password} onChangeText={setPassword} />
          <Field label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />
          {error && <ErrorText>{error}</ErrorText>}
          <Button label="Save new password" variant="dark" loading={busy}
            disabled={!token || password.length < 8} onPress={submit} />
        </View>
      </View>
    </SafeAreaView>
  );
}
