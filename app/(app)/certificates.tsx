import { useMutation, useQuery } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import type { Certificate } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, ErrorText, Screen, Subtitle } from "@/components/ui";

// No global `btoa` assumption -- a small self-contained base64 encoder, since
// PDF bytes have to be written to disk as a base64 string (expo-file-system's
// writeAsStringAsync requirement for binary data).
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    result += B64_CHARS[b1 >> 2];
    result += B64_CHARS[((b1 & 0x03) << 4) | (b2 !== undefined ? b2 >> 4 : 0)];
    result += b2 !== undefined ? B64_CHARS[((b2 & 0x0f) << 2) | (b3 !== undefined ? b3 >> 6 : 0)] : "=";
    result += b3 !== undefined ? B64_CHARS[b3 & 0x3f] : "=";
  }
  return result;
}

export default function Certificates() {
  const certificates = useQuery({
    queryKey: ["certificates", "me"],
    queryFn: async () => (await api.get<Certificate[]>("/certificates/me")).data,
  });
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useMutation({
    mutationFn: async (certificate: Certificate) => {
      setDownloadingId(certificate.id);
      setError(null);
      // Goes through the authenticated `api` client (same interceptors as
      // everywhere else in the app -- token attached, 401 refresh handled
      // automatically) instead of Linking.openURL, which opened the raw
      // download URL in the device's browser with no auth at all.
      const response = await api.get(`/certificates/${certificate.id}/download`, {
        responseType: "arraybuffer",
      });
      const base64 = arrayBufferToBase64(response.data as ArrayBuffer);
      const fileUri = `${FileSystem.documentDirectory}certificate-${certificate.period_type}-${certificate.id}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/pdf",
          dialogTitle: "Save certificate",
          UTI: "com.adobe.pdf",
        });
      }
    },
    onError: (e) => setError(errorDetail(e)),
    onSettled: () => setDownloadingId(null),
  });

  return (
    <Screen>
      <Subtitle>
        Issued automatically at the end of every month and year — a portable record of your work. No approval needed.
      </Subtitle>
      {error && <ErrorText>{error}</ErrorText>}
      <QueryBoundary query={certificates}>
        {(rows) => (
          <View className="mt-4">
            {rows.length === 0 && <EmptyText>Your first certificate arrives at the end of this month.</EmptyText>}
            {rows.map((certificate) => {
              const isDownloading = downloadingId === certificate.id;
              return (
                <Pressable
                  key={certificate.id}
                  disabled={!certificate.pdf_url || isDownloading}
                  onPress={() => download.mutate(certificate)}
                >
                  <Card className="mb-2 flex-row items-center justify-between py-3">
                    <View>
                      <Text className="font-sansmed text-[14px] capitalize text-ink">
                        {certificate.period_type} certificate
                      </Text>
                      <Text className="font-sans text-xs text-faint">
                        {certificate.period_start} → {certificate.period_end}
                      </Text>
                    </View>
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#a8672f" />
                    ) : (
                      <Badge
                        label={certificate.pdf_url ? "save" : "generating"}
                        tone={certificate.pdf_url ? "copper" : "neutral"}
                      />
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </QueryBoundary>
    </Screen>
  );
}