import { ScreenHeading } from "./ScreenHeading";
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "@/context/ScheduleContext";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { calculatePendingPayments } from "@/utils/paymentUtils";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";
import { AppHeader } from "./AppHeader";

interface HomeOverviewProps {
  onMenuPress?: () => void;
}

interface StatCardProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
  highlighted?: boolean;
  onPress: () => void;
}

const StatCard = ({ icon, label, value, highlighted = false, onPress }: StatCardProps) => {
  const { colors } = useAppTheme();
  const cardClass = highlighted
    ? "bg-primary-soft border-primary-soft"
    : "bg-surface border-divider";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 gap-2 rounded-xl border p-3 ${cardClass}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text className="font-subtitle text-content text-[29px]">{value}</Text>
      <Text className="text-muted text-[10px]" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Top app bar for the manager home. The greeting and stats live in HomeOverview. */
export const HomeHeader = () => <AppHeader role="manager" />;

export const HomeOverview = ({ onMenuPress }: HomeOverviewProps) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { caregivers, paymentHistory } = useSchedule();
  const upcomingPayments = useUpcomingPayments();
  const navigation = useNavigation<any>();

  // Calculate pending payments using the same logic as payments screen
  const pendingPayments = useMemo(() => {
    return calculatePendingPayments(upcomingPayments);
  }, [upcomingPayments]);

  const today = new Date();
  const greeting = () => {
    const hour = today.getHours();
    if (hour < 12) return t("common.greeting.morning");
    if (hour < 18) return t("common.greeting.afternoon");
    return t("common.greeting.evening");
  };

  const totalPendingPayments = pendingPayments.length;

  return (
    <View className="gap-[22px]">
      {/* Greeting */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <ScreenHeading title={t("home.overviewTitle")} subtitle={greeting()} />
        </View>
        {onMenuPress && (
          <Pressable
            onPress={onMenuPress}
            className="border-divider bg-surface h-12 w-12 items-center justify-center rounded-xl border"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityLabel={t("common.home.menu")}
            accessibilityRole="button">
            <Ionicons name="menu-outline" size={20} color={colors.text} accessibilityLabelHidden />
          </Pressable>
        )}
      </View>

      {/* Stats Cards */}
      <View className="flex-row gap-2">
        <StatCard
          icon="people-outline"
          label={t("common.home.caregivers")}
          value={caregivers.length}
          highlighted
          onPress={() => navigation.navigate("Caregivers")}
        />
        <StatCard
          icon="card-outline"
          label={t("common.home.payments")}
          value={paymentHistory.length}
          onPress={() => navigation.navigate("History")}
        />
        <StatCard
          icon="time-outline"
          label={t("common.home.pending")}
          value={totalPendingPayments}
          onPress={() => navigation.navigate("Payments")}
        />
      </View>
    </View>
  );
};
