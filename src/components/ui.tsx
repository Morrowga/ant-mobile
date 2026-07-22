/** Small NativeWind UI kit — coffee palette, same product family as the dashboard. */
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View,
  type PressableProps, type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({ children, scroll = true, padded = true, refreshing, onRefresh }: {
  children: React.ReactNode; scroll?: boolean; padded?: boolean;
  /** Pull-to-refresh -- both optional, only takes effect when scroll is
   * true (RefreshControl requires a scrollable container). Pass
   * `isFetching` from whatever query(s) power the page as `refreshing`,
   * and a function that calls refetch()/invalidateQueries as onRefresh. */
  refreshing?: boolean; onRefresh?: () => void;
}) {
  // flex-1 only applies when NOT scrolling -- a ScrollView's direct child
  // needs to size itself naturally (its content height) to scroll
  // correctly; giving it flex-1 there would break scrolling. But a
  // non-scrolling screen (scroll={false}, used by the health check-in
  // modals) NEEDS flex-1 here so nested `flex-1 justify-center` content
  // actually has something to expand within -- without it, content just
  // collapses to the top instead of centering, leaving a blank area below.
  const paddedClass = scroll ? "px-5 pb-10 pt-2" : "flex-1 px-5 pb-10 pt-2";
  const inner = padded ? <View className={paddedClass}>{children}</View> : <>{children}</>;
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-cream">
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#6c4b36" />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : inner}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text className="font-display text-2xl text-ink">{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text className="mt-1 font-sans text-sm text-faint">{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 mt-6 font-sansbold text-xs uppercase tracking-widest text-faint">{children}</Text>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-line bg-paper p-4 ${className ?? ""}`}>{children}</View>;
}

interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "dark" | "outline" | "ghost" | "danger";
  loading?: boolean;
}

export function Button({ label, variant = "primary", loading, disabled, className, ...props }: ButtonProps & { className?: string }) {
  const base = "h-12 flex-row items-center justify-center rounded-xl px-5";
  const styles: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-latte-deep", text: "text-ink" },       // latte darkened for button weight
    dark: { bg: "bg-espresso", text: "text-cream" },
    outline: { bg: "border border-espresso/40 bg-transparent", text: "text-espresso" },
    ghost: { bg: "bg-transparent", text: "text-copper" },
    danger: { bg: "bg-[#a63d2f]", text: "text-cream" },
  };
  const s = styles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      className={`${base} ${s.bg} ${disabled || loading ? "opacity-50" : "active:opacity-80"} ${className ?? ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === "dark" || variant === "danger" ? "#f4f4f4" : "#2b2a2a"} /> :
        <Text className={`font-sansbold text-[15px] ${s.text}`}>{label}</Text>}
    </Pressable>
  );
}

export function Field({
  label, error, secureToggle, secureTextEntry, ...props
}: TextInputProps & { label: string; error?: string; secureToggle?: boolean }) {
  // Opt-in only (secureToggle prop) -- every other Field usage across the
  // app is unaffected, this is purely additive for password-style inputs.
  const [visible, setVisible] = useState(false);
  const isPasswordField = secureToggle && secureTextEntry;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-sansmed text-[13px] text-ink">{label}</Text>
      <View className="relative justify-center">
        <TextInput
          className="h-12 rounded-xl border border-line bg-paper px-4 font-sans text-[15px] text-ink"
          placeholderTextColor="#8a8580"
          secureTextEntry={isPasswordField ? !visible : secureTextEntry}
          style={isPasswordField ? { paddingRight: 44 } : undefined}
          {...props}
        />
        {isPasswordField && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            className="absolute right-3 h-8 w-8 items-center justify-center"
            hitSlop={8}
          >
            {visible ? <EyeOff size={18} color="#8a8580" /> : <Eye size={18} color="#8a8580" />}
          </Pressable>
        )}
      </View>
      {error ? <Text className="mt-1 font-sans text-xs text-[#a63d2f]">{error}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" | "copper" }) {
  const tones: Record<string, string> = {
    neutral: "bg-latte/50 text-espresso",
    good: "bg-[#dcebd9] text-[#2f5d33]",
    warn: "bg-[#f3e4c8] text-[#7a5518]",
    bad: "bg-[#f0d9d5] text-[#8c3529]",
    copper: "bg-[#f0e0cf] text-copper",
  };
  const [bg, text] = tones[tone].split(" ");
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${bg}`}>
      <Text className={`font-sansmed text-[11px] ${text}`}>{label}</Text>
    </View>
  );
}

export function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`flex-row items-center ${className ?? ""}`}>{children}</View>;
}

export function EmptyText({ children }: { children: React.ReactNode }) {
  return <Text className="py-6 text-center font-sans text-sm text-faint">{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text className="my-2 font-sans text-sm text-[#a63d2f]">{children}</Text>;
}

export function Loading() {
  return (
    <View className="items-center py-10">
      <ActivityIndicator color="#6c4b36" />
    </View>
  );
}

/** 402 state — with RequireActivePlan on every backend router, a lapsed
 *  company plan lands here. Employees can't fix billing, so say who can. */
export function PlanGateCard({ detail }: { detail?: string }) {
  return (
    <Card className="items-center py-8">
      <Text className="font-display text-lg text-ink">Feature unavailable</Text>
      <Text className="mt-2 text-center font-sans text-sm text-faint">
        {detail ?? "Your company's plan doesn't include this."}
        {"\n"}Ask your company admin — plans are managed on the web dashboard.
      </Text>
    </Card>
  );
}