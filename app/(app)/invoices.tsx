import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
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

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function Invoices() {
  const currency = useCompanyCurrency();
  const invoices = useQuery({
    queryKey: ["invoices", "me"],
    queryFn: async () => (await api.get<PayrollInvoice[]>("/invoices/me")).data,
  });

  return (
    <Screen>
      <Title>Invoices</Title>
      <QueryBoundary query={invoices}>
        {(rows) => (
          <View className="mt-2">
            {rows.length === 0 && (
              <EmptyText>No invoices yet — these appear once your company generates one for a pay period.</EmptyText>
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
                      <Badge label={invoice.actual_working_hours ? "actual" : "scheduled"} tone="neutral" />
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