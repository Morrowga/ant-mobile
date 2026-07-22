/** Create post — allowed only if the company setting permits employee posting
 *  (Knowledge type only; Sharing is always open to everyone); a 403 from the
 *  backend is surfaced as a plain explanation, not a crash. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, Text, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import type { PostType } from "@/lib/types";
import { Button, Card, ErrorText, Row, Screen } from "@/components/ui";

export default function NewKnowledgePost() {
  const { post_type: initialType } = useLocalSearchParams<{ post_type?: string }>();
  const qc = useQueryClient();
  const [postType, setPostType] = useState<PostType>(initialType === "sharing" ? "sharing" : "knowledge");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSharing = postType === "sharing";

  const create = useMutation({
    mutationFn: () => api.post("/knowledge/posts", {
      title: title.trim(),
      body: body.trim(),
      post_type: postType,
      // Category doesn't apply to Sharing at all -- only sent for Knowledge.
      ...(isSharing ? {} : { category: "general" }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["knowledge"] }); router.back(); },
    onError: (e) => setError(errorDetail(e)),
  });

  return (
    <Screen>
      <Card>
        <Text className="mb-1.5 font-sansmed text-[13px] text-ink">Type</Text>
        <Row className="mb-3 gap-2">
          <Pressable onPress={() => setPostType("knowledge")} className="flex-1">
            <View className={`items-center rounded-xl border py-2.5 ${!isSharing ? "border-espresso bg-espresso" : "border-line bg-cream"}`}>
              <Text className={`font-sansbold text-[13px] ${!isSharing ? "text-cream" : "text-ink"}`}>Knowledge</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setPostType("sharing")} className="flex-1">
            <View className={`items-center rounded-xl border py-2.5 ${isSharing ? "border-espresso bg-espresso" : "border-line bg-cream"}`}>
              <Text className={`font-sansbold text-[13px] ${isSharing ? "text-cream" : "text-ink"}`}>Sharing</Text>
            </View>
          </Pressable>
        </Row>
        <Text className="mb-3 font-sans text-[12px] text-faint">
          {isSharing
            ? "Open to everyone to post — no category, just a post everyone in the company can comment on."
            : "Company know-how, governed by your Knowledge settings."}
        </Text>

        <Text className="mb-1.5 font-sansmed text-[13px] text-ink">Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholderTextColor="#8a8580"
          placeholder="Something worth sharing" className="mb-3 h-12 rounded-xl border border-line bg-cream px-4 font-sans text-ink" />
        <Text className="mb-1.5 font-sansmed text-[13px] text-ink">Body</Text>
        <TextInput multiline value={body} onChangeText={setBody} textAlignVertical="top" placeholderTextColor="#8a8580"
          placeholder="Write it the way you'd explain it to a new teammate."
          className="min-h-[140px] rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink" />
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Publish" variant="dark" className="mt-3"
          disabled={title.trim().length < 3 || body.trim().length < 10}
          loading={create.isPending} onPress={() => create.mutate()} />
      </Card>
    </Screen>
  );
}