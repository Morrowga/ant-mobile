import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";

import { api } from "@/lib/api-client";
import type { PayrollInvoice } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Button, Card, ErrorText, Row, Screen } from "@/components/ui";

function useCompanyInfo(): { currency: string; name: string } {
  const query = useQuery({
    queryKey: ["company", "info"],
    queryFn: async () => (await api.get<{ currency?: string; name?: string }>("/company/info")).data,
  });
  return { currency: query.data?.currency ?? "USD", name: query.data?.name ?? "" };
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
function fmtStamp(iso: string): string {
  return new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currency, name: companyName } = useCompanyInfo();
  const invoice = useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => (await api.get<PayrollInvoice>(`/invoices/${id}`)).data,
    enabled: !!id,
  });

  return (
    <Screen>
      <QueryBoundary query={invoice}>
        {(inv) => (
          <Card>
            {/* Header */}
            <Row className="items-start justify-between border-b border-line pb-3">
              <View>
                <Text className="font-sans text-[11px] uppercase tracking-wider text-faint">Invoice</Text>
                <Text className="mt-1 font-display text-xl text-ink">
                  {fmtDay(inv.period_start)} – {fmtDay(inv.period_end)}
                </Text>
              </View>
              {companyName ? (
                <Text className="font-sansmed text-[13px] text-faint">{companyName}</Text>
              ) : null}
            </Row>

            {/* Itemized line */}
            <View className="mt-3">
              <Row className="justify-between">
                <Text className="font-sans text-[11px] uppercase tracking-wide text-faint">Description</Text>
                <Text className="font-sans text-[11px] uppercase tracking-wide text-faint">Amount</Text>
              </Row>
              <Row className="mt-2 items-baseline justify-between border-t border-line pt-2">
                <Text className="font-sans text-[14px] text-ink">
                  Hours worked <Text className="text-faint">({inv.total_hours.toFixed(2)}h)</Text>
                </Text>
                <Text className="font-sansmed text-[14px] text-ink tabular-nums">
                  {fmtMoney(inv.total_amount, currency)}
                </Text>
              </Row>
              <Text className="mt-1 font-sans text-xs text-faint">
                {fmtMoney(inv.hourly_fee, currency)} / hour
              </Text>
            </View>

            {/* Total */}
            <Row className="mt-4 items-center justify-between border-t-2 border-ink/15 pt-3">
              <Text className="font-display text-base text-ink">Total</Text>
              <Text className="font-display text-2xl text-ink tabular-nums">
                {fmtMoney(inv.total_amount, currency)}
              </Text>
            </Row>

            <Text className="mt-3 font-sans text-xs text-faint">
              Calculated from {inv.actual_working_hours ? "actual clocked hours" : "scheduled hours minus leave"}
              {" · "}Generated {fmtStamp(inv.generated_at)}
            </Text>

            {inv.pdf_url ? (
              <Button
                label="Download PDF" variant="dark" className="mt-4"
                onPress={() => Linking.openURL(inv.pdf_url as string)}
              />
            ) : (
              <Text className="mt-4 text-center font-sans text-xs text-faint">File not available.</Text>
            )}
          </Card>
        )}
      </QueryBoundary>
      {invoice.isError && <ErrorText>Couldn't load this invoice.</ErrorText>}
    </Screen>
  );
}