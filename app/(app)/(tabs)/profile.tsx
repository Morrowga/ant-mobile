import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { CompanyInfo, TeamInfo } from "@/lib/types";
import { Button, Card, Row, Screen, SectionTitle, Subtitle, Title } from "@/components/ui";

export default function Profile() {
  const { t } = useTranslation();
  const { me, signOut } = useAuth();
  const team = useQuery({
    queryKey: ["me", "team"],
    queryFn: async () => (await api.get<TeamInfo | null>("/me/team")).data,
  });
  const company = useQuery({
    queryKey: ["company", "info"],
    queryFn: async () => (await api.get<CompanyInfo>("/company/info")).data,
  });

  return (
    <Screen>
      <Title>{me?.full_name ?? me?.email}</Title>
      <Subtitle>
        {me?.role === "manager" ? t("features.profile.managerRole") : t("features.profile.employeeRole")}
        {company.data ? ` · ${company.data.name}` : ""}
        {team.data?.name ? ` · ${team.data.name}` : ""}
      </Subtitle>

      <SectionTitle>{t("features.profile.yourRecords")}</SectionTitle>
      <MenuLink href="/(app)/certificates" label={t("features.profile.certificates")} hint={t("features.profile.certificatesHint")} />
      <MenuLink href="/(app)/recognitions" label={t("features.profile.kudosReceived")} hint={t("features.profile.kudosHint")} />
      <MenuLink href="/(app)/attendance-history" label={t("features.profile.attendanceHistory")} hint={t("features.profile.attendanceHint")} />
      <MenuLink href="/(app)/invoices" label={t("features.profile.invoices")} hint={t("features.profile.invoicesHint")} />

      <SectionTitle>{t("features.profile.haveASay")}</SectionTitle>
      <MenuLink href="/(app)/feedback" label={t("features.profile.feedback")} hint={t("features.profile.feedbackHint")} />

      <SectionTitle>{t("features.profile.settings")}</SectionTitle>
      <MenuLink href="/(app)/desk-location" label={t("features.profile.deskLocation")} hint={t("features.profile.deskLocationHint")} />
      <MenuLink href="/(app)/notification-preferences" label={t("features.profile.notificationPreferences")} hint={t("features.profile.notificationPreferencesHint")} />
      {/* New: same binary toggle as the portal -- switch back to English,
          or back to whatever the company assigned. See app/(app)/language.tsx. */}
      <MenuLink href="/(app)/language" label={t("features.profile.language")} hint={t("features.profile.languageHint")} />
      <MenuLink href="/(app)/change-password" label={t("features.profile.changePassword")} />

      <View className="mt-8">
        <Button label={t("features.profile.signOut")} variant="outline" onPress={signOut} />
      </View>
    </Screen>
  );
}

function MenuLink({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable>
        <Card className="mb-2 py-3">
          <Row className="justify-between">
            <View>
              <Text className="font-sansmed text-[15px] text-ink">{label}</Text>
              {hint && <Text className="mt-0.5 font-sans text-xs text-faint">{hint}</Text>}
            </View>
            <Text className="text-copper">›</Text>
          </Row>
        </Card>
      </Pressable>
    </Link>
  );
}