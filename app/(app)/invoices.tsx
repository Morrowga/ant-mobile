import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { PayrollInvoice } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, Row, Screen, Title } from "@/components/ui";

function useCompanyCurrency(): string {
  const query = useQuery({
    queryKey: ["company", "info"],
    queryFn: async () => (await api.get<{ currency?: string }>("/company/info")).data,
  });
  return query.data?.currency ?? "USD";
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

export default function Invoices() {
  const { t, i18n } = useTranslation();
  const currency = useCompanyCurrency();
  const invoices = useQuery({
    queryKey: ["invoices", "me"],
    queryFn: async () => (await api.get<PayrollInvoice[]>("/invoices/me")).data,
  });

  const fmtDay = (iso: string): string =>
    new Date(iso).toLocaleDateString(i18n.language, { month: "short", day: "numeric" });

  return (
    <Screen>
      <Title>{t("features.invoices.pageTitle")}</Title>
      <QueryBoundary query={invoices}>
        {(rows) => (
          <View className="mt-2">
            {rows.length === 0 && (
              <EmptyText>{t("features.invoices.empty")}</EmptyText>
            )}
            {[...rows].sort((a, b) => b.period_start.localeCompare(a.period_start)).map((invoice) => (
              <Link key={invoice.id} href={{ pathname: "/(app)/invoices/[id]", params: { id: String(invoice.id) } }} asChild>
                <Pressable>
                  <Card className="mb-2 py-3">
                    <Row className="justify-between">
                      <View>
                        <Text className="font-sansmed text-[15px] text-ink">
                          {fmtDay(invoice.period_start)} – {fmtDay(invoice.period_end)}
                        </Text>
                        <Text className="mt-0.5 font-sans text-xs text-faint">
                          {invoice.total_hours.toFixed(2)}h · {fmtMoney(invoice.total_amount, currency)}
                        </Text>
                      </View>
                      <Badge label={invoice.actual_working_hours ? t("features.invoices.actual") : t("features.invoices.scheduled")} tone="neutral" />
                    </Row>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}