/**
 * Desk location — history of approved locations, plus a way to request a
 * change. Changes now go through Owner/Manager approval rather than
 * applying instantly (see attendance_service.py's
 * request_desk_location_change) -- submitting here creates a pending
 * request, it doesn't update the location immediately.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Modal, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { getCurrentPosition } from "@/lib/location";
import { Badge, Button, Card, ErrorText, Row, Screen, Subtitle, Title } from "@/components/ui";

interface DeskLocationHistoryRow { id: number; lat: number; lng: number; set_at: string }
interface DeskLocationRequestRow {
  id: number; lat: number; lng: number; status: "pending" | "approved" | "rejected";
  created_at: string; decided_at: string | null;
}
interface DeskLocationData { history: DeskLocationHistoryRow[]; requests: DeskLocationRequestRow[] }

const fmtDateTime = (value: string) =>
  new Date(value).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const mapLink = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default function DeskLocation() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["attendance", "desk-location", "me"],
    queryFn: async () => (await api.get<DeskLocationData>("/attendance/desk-location/me")).data,
  });

  const request = useMutation({
    mutationFn: async () => {
      const position = await getCurrentPosition();
      return api.post("/attendance/desk-location/request", {
        lat: position.coords.latitude, lng: position.coords.longitude,
      });
    },
    onSuccess: () => {
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["attendance", "desk-location", "me"] });
    },
    onError: (e) => setError(errorDetail(e)),
  });

  const pendingRequest = data.data?.requests.find((r) => r.status === "pending");

  return (
    <Screen>
      <Title>Desk location</Title>
      <Subtitle>Where your check-ins are compared against — changes need your manager's approval.</Subtitle>

      <Card className="mt-4">
        {pendingRequest ? (
          <>
            <Row className="items-center justify-between">
              <Text className="font-sansmed text-[14px] text-ink">Update requested</Text>
              <Badge label="pending approval" tone="warn" />
            </Row>
            <Text className="mt-1 font-sans text-[13px] text-faint">
              Submitted {fmtDateTime(pendingRequest.created_at)} — waiting on your manager.
            </Text>
          </>
        ) : (
          <>
            <Text className="font-sansmed text-[14px] text-ink">Update your desk location</Text>
            <Text className="mt-1 font-sans text-[13px] text-faint">
              Uses your current location. Your manager reviews it before it takes effect.
            </Text>
            {error && <ErrorText>{error}</ErrorText>}
            <Button
              label="Request update" variant="dark" className="mt-3"
              onPress={() => { setError(null); setConfirmOpen(true); }}
            />
          </>
        )}
      </Card>

      <Text className="mb-2 mt-6 font-sansbold text-[14px] text-ink">History</Text>
      {(data.data?.history.length ?? 0) === 0 && (
        <Card><Text className="font-sans text-[13px] text-faint">No desk location set yet.</Text></Card>
      )}
      {data.data?.history.map((h) => (
        <Card key={h.id} className="mb-2">
          <Text className="font-sans text-[13px] text-ink">{fmtDateTime(h.set_at)}</Text>
          <Text
            className="mt-1 font-sans text-xs text-copper underline"
            onPress={() => Linking.openURL(mapLink(h.lat, h.lng))}
          >
            {h.lat.toFixed(5)}, {h.lng.toFixed(5)}
          </Text>
        </Card>
      ))}

      <Modal visible={confirmOpen} animationType="fade" transparent onRequestClose={() => setConfirmOpen(false)}>
        <View className="flex-1 items-center justify-center bg-ink/40 px-6">
          <View className="w-full rounded-2xl bg-paper p-5">
            <Text className="font-display text-lg text-ink">Request a desk location update?</Text>
            <Text className="mt-1 font-sans text-[13px] text-faint">
              This uses your current location right now. It won't take effect until your manager approves it.
            </Text>
            {error && <ErrorText>{error}</ErrorText>}
            <Row className="mt-4 gap-2">
              <Button label="Cancel" variant="outline" className="flex-1" onPress={() => setConfirmOpen(false)} />
              <Button label="Send request" variant="dark" className="flex-1"
                loading={request.isPending} onPress={() => request.mutate()} />
            </Row>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}