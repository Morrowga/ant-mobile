import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { errorDetail } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Button, ErrorText, Field } from "@/components/ui";

/** Deep link target: ants://accept-invite?token=... — also works manually. */
export default function AcceptInvite() {
  const params = useLocalSearchParams<{ token?: string }>();
  const { acceptInvite } = useAuth();
  const [token, setToken] = useState(params.token ?? "");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await acceptInvite(token.trim(), password, fullName.trim() || undefined);
      router.replace("/");
    } catch (e) {
      setError(errorDetail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-espresso">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-white">
              <Image
                source={require("../../assets/images/logo.png")}
                className="h-15 w-12"
                resizeMode="contain"
              />
            </View>
            <Text className="mt-3 font-displaybold text-2xl text-cream">Join Your Company</Text>
          </View>
          <View className="rounded-2xl bg-paper p-5">
            <Field label="Invite code" autoCapitalize="none" value={token} onChangeText={setToken}
              placeholder="Paste the code from your invite email" />
            <Field label="Your name" value={fullName} onChangeText={setFullName} placeholder="First Last" />
            <Field label="Choose a password" secureTextEntry autoComplete="new-password"
              value={password} onChangeText={setPassword} placeholder="At least 8 characters" />
            {error && <ErrorText>{error}</ErrorText>}
            <Button label="Create account" variant="dark" loading={busy}
              disabled={!token || password.length < 8} onPress={submit} />
            <Button label="Back to sign in" variant="ghost" className="mt-2" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}