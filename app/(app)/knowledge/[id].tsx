import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Text, TextInput, View } from "react-native";

import { api, errorDetail } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import type { KnowledgePost } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Button, Card, ErrorText, Row, Screen } from "@/components/ui";

interface CommentRow { id: number; author_id: number; comment: string; author_name: string | null; created_at: string }
interface PostDetail extends KnowledgePost {
  author_id: number;
  acknowledged_by_me?: boolean;
  comments: CommentRow[];
}

const URL_SPLIT_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Splits text on URLs and renders each match as a tappable link, opening
 * in the device's browser -- everything else renders as plain text,
 * inheriting whatever className is passed in. Uses a fresh non-global
 * regex per check rather than reusing one global instance's .test(),
 * which would otherwise give inconsistent results across the loop due to
 * lastIndex being stateful on global regexes. */
function Linkified({ text, className }: { text: string; className?: string }) {
  const isUrl = (part: string) => /^https?:\/\/[^\s]+$/.test(part);
  const parts = text.split(URL_SPLIT_PATTERN);
  return (
    <Text className={className}>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <Text
            key={i}
            className="text-copper underline"
            onPress={() => Linking.openURL(part).catch(() => {})}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export default function KnowledgeDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const qc = useQueryClient();
  const post = useQuery({
    queryKey: ["knowledge", "post", id],
    queryFn: async () => (await api.get<PostDetail>(`/knowledge/posts/${id}`)).data,
  });
  const [acked, setAcked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const acknowledge = useMutation({
    mutationFn: () => api.post(`/knowledge/posts/${id}/acknowledge`),
    onSuccess: () => { setAcked(true); qc.invalidateQueries({ queryKey: ["knowledge"] }); },
    onError: (e) => setError(errorDetail(e)),
  });

  const addComment = useMutation({
    mutationFn: (comment: string) => api.post(`/knowledge/posts/${id}/comment`, { comment }),
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["knowledge", "post", id] });
    },
    onError: (e) => setError(errorDetail(e)),
  });

  return (
    <Screen>
      <QueryBoundary query={post}>
        {(data) => {
          const isSharing = data.post_type === "sharing";
          return (
            <>
              <Card>
                <Row className="items-center gap-2">
                  <Badge label={isSharing ? t("features.knowledge.tabs.sharing") : t("features.knowledge.tabs.knowledge")} tone={isSharing ? "neutral" : "warn"} />
                  {data.category && !isSharing && <Badge label={data.category.replace("_", " ")} />}
                </Row>
                <Text className="mt-2 font-display text-xl text-ink">{data.title}</Text>
                <Linkified text={data.body ?? ""} className="mt-3 font-sans text-[14px] leading-6 text-ink" />
              </Card>

              {/* Sharing's whole point is open, company-wide discussion --
                  comments were removed from this screen earlier for
                  Knowledge posts, but reintroduced here specifically for
                  Sharing, where they're the actual point of the post. */}
              {isSharing && (
                <Card className="mt-3">
                  <Text className="mb-2 font-sansbold text-[14px] text-ink">
                    {t("features.knowledgePost.comments", { count: data.comments.length })}
                  </Text>
                  {data.comments.length === 0 && (
                    <Text className="mb-2 font-sans text-[13px] text-faint">{t("features.knowledgePost.noComments")}</Text>
                  )}
                  {data.comments.map((c) => {
                    const isPostAuthor = c.author_id === data.author_id;
                    const isMine = me?.id === c.author_id;
                    return (
                      <View
                        key={c.id}
                        className={`mb-2 rounded-xl border p-3 ${
                          isPostAuthor ? "border-copper bg-latte/50" : "border-line bg-cream"
                        }`}
                      >
                        <Linkified text={c.comment} className="font-sans text-[13px] text-ink" />
                        <Row className="mt-1 items-center gap-1">
                          <Text className="font-sans text-[11px] text-faint">
                            {isMine ? t("features.knowledgePost.you") : c.author_name ?? t("features.knowledgePost.someone")} · {new Date(c.created_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                          </Text>
                          {isPostAuthor && <Badge label={t("features.knowledgePost.author")} tone="neutral" />}
                        </Row>
                      </View>
                    );
                  })}
                  <TextInput
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder={t("features.knowledgePost.commentPlaceholder")}
                    placeholderTextColor="#8a8580"
                    multiline
                    className="mt-2 h-20 rounded-xl border border-line bg-cream px-4 py-3 font-sans text-ink"
                  />
                  {error && <ErrorText>{error}</ErrorText>}
                  <Button
                    label={t("features.knowledgePost.postComment")}
                    variant="dark"
                    className="mt-2"
                    disabled={!commentText.trim()}
                    loading={addComment.isPending}
                    onPress={() => addComment.mutate(commentText.trim())}
                  />
                </Card>
              )}

              {data.must_acknowledge && (
                <Card className="mt-3">
                  {acked || data.acknowledged_by_me ? (
                    <Badge label={t("features.knowledgePost.acknowledged")} tone="good" />
                  ) : (
                    <>
                      <Text className="mb-2 font-sans text-[13px] text-faint">
                        {t("features.knowledgePost.mustReadNote")}
                      </Text>
                      {error && <ErrorText>{error}</ErrorText>}
                      <Button label={t("features.knowledgePost.iveReadThis")} variant="dark" loading={acknowledge.isPending}
                        onPress={() => acknowledge.mutate()} />
                    </>
                  )}
                </Card>
              )}
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}