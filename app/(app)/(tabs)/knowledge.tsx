import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { api } from "@/lib/api-client";
import type { KnowledgePost, PostType } from "@/lib/types";
import { QueryBoundary } from "@/components/query";
import { Badge, Card, EmptyText, Row, Screen, Subtitle, Title } from "@/components/ui";

export default function Knowledge() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PostType>("knowledge");
  const [search, setSearch] = useState("");
  const posts = useQuery({
    queryKey: ["knowledge", tab, search],
    queryFn: async () =>
      (await api.get<KnowledgePost[]>("/knowledge/posts", {
        params: { post_type: tab, ...(search ? { search } : {}) },
      })).data,
  });

  return (
    <Screen refreshing={posts.isFetching} onRefresh={() => posts.refetch()}>
      <Row className="justify-between">
        <Title>{t("features.knowledge.pageTitle")}</Title>
        <Link
          href={{ pathname: "/(app)/knowledge/new", params: { post_type: tab } }}
          className="font-sansbold text-[14px] text-copper"
        >
          {t("features.knowledge.newPost")}
        </Link>
      </Row>
      <Subtitle>
        {tab === "knowledge"
          ? t("features.knowledge.knowledgeDescription")
          : t("features.knowledge.sharingDescription")}
      </Subtitle>

      <Row className="mt-4 gap-2">
        <Pressable onPress={() => setTab("knowledge")} className="flex-1">
          <View className={`items-center rounded-xl border py-2.5 ${tab === "knowledge" ? "border-espresso bg-espresso" : "border-line bg-paper"}`}>
            <Text className={`font-sansbold text-[13px] ${tab === "knowledge" ? "text-cream" : "text-ink"}`}>{t("features.knowledge.tabs.knowledge")}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setTab("sharing")} className="flex-1">
          <View className={`items-center rounded-xl border py-2.5 ${tab === "sharing" ? "border-espresso bg-espresso" : "border-line bg-paper"}`}>
            <Text className={`font-sansbold text-[13px] ${tab === "sharing" ? "text-cream" : "text-ink"}`}>{t("features.knowledge.tabs.sharing")}</Text>
          </View>
        </Pressable>
      </Row>

      <TextInput
        value={search} onChangeText={setSearch} placeholder={t("features.knowledge.searchPlaceholder")} placeholderTextColor="#8a8580"
        className="mt-3 h-11 rounded-xl border border-line bg-paper px-4 font-sans text-ink"
      />
      <QueryBoundary query={posts}>
        {(rows) => {
          const sorted = tab === "knowledge" ? [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned)) : rows;
          return (
            <View className="mt-3">
              {sorted.length === 0 && (
                <EmptyText>{tab === "knowledge" ? t("features.knowledge.noPostsFound") : t("features.knowledge.noSharingPostsYet")}</EmptyText>
              )}
              {sorted.map((post) => (
                <Link key={post.id} href={{ pathname: "/(app)/knowledge/[id]", params: { id: String(post.id) } }} asChild>
                  <Pressable>
                    <Card className="mb-2">
                      <Row className="justify-between">
                        <Text className="flex-1 pr-2 font-sansbold text-[15px] text-ink">
                          {post.pinned ? "📌 " : ""}{post.title}
                        </Text>
                        {post.must_acknowledge && <Badge label={t("features.knowledge.mustRead")} tone="warn" />}
                      </Row>
                      {post.category && tab === "knowledge" && (
                        <Text className="mt-1 font-sans text-xs capitalize text-faint">{post.category.replace("_", " ")}</Text>
                      )}
                    </Card>
                  </Pressable>
                </Link>
              ))}
            </View>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}