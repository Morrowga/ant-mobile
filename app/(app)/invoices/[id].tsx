import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
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

export default function InvoiceDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currency, name: companyName } = useCompanyInfo();
  const invoice = useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => (await api.get<PayrollInvoice>(`/invoices/${id}`)).data,
    enabled: !!id,
  });

  const fmtDay = (iso: string): string =>
    new Date(iso).toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  const fmtStamp = (iso: string): string =>
    new Date(iso).toLocaleString(i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Screen>
      <QueryBoundary query={invoice}>
        {(inv) => (
          <Card>
            {/* Header */}
            <Row className="items-start justify-between border-b border-line pb-3">
              <View>
                <Text className="font-sans text-[11px] uppercase tracking-wider text-faint">{t("features.invoiceDetail.invoice")}</Text>
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
                <Text className="font-sans text-[11px] uppercase tracking-wide text-faint">{t("features.invoiceDetail.description")}</Text>
                <Text className="font-sans text-[11px] uppercase tracking-wide text-faint">{t("features.invoiceDetail.amount")}</Text>
              </Row>
              <Row className="mt-2 items-baseline justify-between border-t border-line pt-2">
                <Text className="font-sans text-[14px] text-ink">
                  {t("features.invoiceDetail.hoursWorked")} <Text className="text-faint">({inv.total_hours.toFixed(2)}h)</Text>
                </Text>
                <Text className="font-sansmed text-[14px] text-ink tabular-nums">
                  {fmtMoney(inv.total_amount, currency)}
                </Text>
              </Row>
              <Text className="mt-1 font-sans text-xs text-faint">
                {t("features.invoiceDetail.perHour", { amount: fmtMoney(inv.hourly_fee, currency) })}
              </Text>
            </View>

            {/* Total */}
            <Row className="mt-4 items-center justify-between border-t-2 border-ink/15 pt-3">
              <Text className="font-display text-base text-ink">{t("features.invoiceDetail.total")}</Text>
              <Text className="font-display text-2xl text-ink tabular-nums">
                {fmtMoney(inv.total_amount, currency)}
              </Text>
            </Row>

            <Text className="mt-3 font-sans text-xs text-faint">
              {t("features.invoiceDetail.calculatedFrom", {
                basis: inv.actual_working_hours ? t("features.invoiceDetail.actualClockedHours") : t("features.invoiceDetail.scheduledMinusLeave"),
              })}
              {" · "}{t("features.invoiceDetail.generated", { time: fmtStamp(inv.generated_at) })}
            </Text>

            {inv.pdf_url ? (
              <Button
                label={t("features.invoiceDetail.downloadPdf")} variant="dark" className="mt-4"
                onPress={() => Linking.openURL(inv.pdf_url as string)}
              />
            ) : (
              <Text className="mt-4 text-center font-sans text-xs text-faint">{t("features.invoiceDetail.fileNotAvailable")}</Text>
            )}
          </Card>
        )}
      </QueryBoundary>
      {invoice.isError && <ErrorText>{t("features.invoiceDetail.loadError")}</ErrorText>}
    </Screen>
  );
}