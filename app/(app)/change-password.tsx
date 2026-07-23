import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, errorDetail } from "@/lib/api-client";
import { Button, Card, ErrorText, Field, Screen } from "@/components/ui";

export default function ChangePassword() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    // Backend serves this at POST /auth/me/change-password (Part B writes /me/change-password — noted in README).
    mutationFn: () => api.post("/auth/me/change-password", { current_password: current, new_password: next }),
    onSuccess: () => router.back(),
    onError: (e) => setError(errorDetail(e)),
  });

  return (
    <Screen>
      <Card>
        <Field label={t("features.changePassword.currentPassword")} secureTextEntry secureToggle value={current} onChangeText={setCurrent} />
        <Field label={t("features.changePassword.newPassword")} secureTextEntry secureToggle value={next} onChangeText={setNext}
          placeholder={t("features.changePassword.newPasswordPlaceholder")} />
        {error && <ErrorText>{error}</ErrorText>}
        <Button label={t("features.changePassword.changePassword")} variant="dark" disabled={!current || next.length < 8}
          loading={change.isPending} onPress={() => change.mutate()} />
      </Card>
    </Screen>
  );
}