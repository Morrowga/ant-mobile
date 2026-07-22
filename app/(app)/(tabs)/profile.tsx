import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { CompanyInfo, TeamInfo } from "@/lib/types";
import { Button, Card, Row, Screen, SectionTitle, Subtitle, Title } from "@/components/ui";

export default function Profile() {
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
        {me?.role === "manager" ? "Manager — team views live on the web dashboard" : "Employee"}
        {company.data ? ` · ${company.data.name}` : ""}
        {team.data?.name ? ` · ${team.data.name}` : ""}
      </Subtitle>

      <SectionTitle>Your records</SectionTitle>
      <MenuLink href="/(app)/certificates" label="Certificates" hint="Auto-issued monthly and yearly" />
      <MenuLink href="/(app)/recognitions" label="Kudos received" hint="Recognition from your managers" />
      <MenuLink href="/(app)/attendance-history" label="Attendance history" hint="Your check-in record" />
      <MenuLink href="/(app)/invoices" label="Invoices" hint="Generated payroll invoices" />

      <SectionTitle>Have a say</SectionTitle>
      <MenuLink href="/(app)/feedback" label="Feedback & complaints" hint="Anonymous option available" />

      <SectionTitle>Settings</SectionTitle>
      <MenuLink href="/(app)/desk-location" label="Desk location" hint="Update where you check in from" />
      <MenuLink href="/(app)/notification-preferences" label="Notification preferences" hint="Mute what you don't need" />
      <MenuLink href="/(app)/change-password" label="Change password" />

      <View className="mt-8">
        <Button label="Sign out" variant="outline" onPress={signOut} />
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