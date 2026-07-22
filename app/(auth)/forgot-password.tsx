import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, errorDetail } from "@/lib/api-client";
import { Button, ErrorText, Field } from "@/components/ui";

/** Wired to POST /auth/forgot-password — a known backend gap (see README). */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
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
          {sent ? (
            <Text className="font-sans text-sm text-ink">
              If an account exists for that address, a reset link is on its way. Open it on this phone to continue.
            </Text>
          ) : (
            <>
              <Text className="mb-4 font-display text-xl text-ink">Reset your password</Text>
              <Field label="Email" autoCapitalize="none" keyboardType="email-address"
                value={email} onChangeText={setEmail} placeholder="you@company.com" />
              {error && <ErrorText>{error}</ErrorText>}
              <Button label="Send reset link" variant="dark" loading={busy} disabled={!email} onPress={submit} />
            </>
          )}
          <Button label="Back to sign in" variant="ghost" className="mt-2" onPress={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
