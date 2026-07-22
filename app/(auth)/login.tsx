import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { errorDetail } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field } from "@/components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(errorDetail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-espresso">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <Text className="font-displaybold text-4xl text-cream">Ants</Text>
        <Text className="mb-8 mt-1 font-sans text-sm text-latte">Check in, report your day, stay on track.</Text>
        <View className="rounded-2xl bg-paper p-5">
          <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address"
            value={email} onChangeText={setEmail} placeholder="you@company.com" />
          <Field label="Password" secureTextEntry autoComplete="current-password"
            value={password} onChangeText={setPassword} placeholder="••••••••" />
          {error && <ErrorText>{error}</ErrorText>}
          <Button label="Sign in" variant="dark" loading={busy} disabled={!email || !password} onPress={submit} />
          <View className="mt-4 flex-row justify-between">
            <Link href="/(auth)/accept-invite" className="font-sansmed text-[13px] text-copper">Have an invite?</Link>
            <Link href="/(auth)/forgot-password" className="font-sansmed text-[13px] text-copper">Forgot password?</Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
