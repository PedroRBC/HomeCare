import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "@/context/ScheduleContext";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { calculatePendingPayments } from "@/utils/paymentUtils";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";
import { AppLogo } from "./AppLogo";

interface HomeHeaderProps {
  onMenuPress?: () => void;
  onScrollToPendingPayments?: () => void;
}

interface StatCardProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
  onPress: () => void;
}

const StatCard = ({ icon, label, value, onPress }: StatCardProps) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      className="border-divider bg-surface-raised flex-1 rounded-2xl border p-3.5"
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View className="bg-primary-soft h-8 w-8 items-center justify-center rounded-lg">
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text className="text-muted mt-2 text-xs" numberOfLines={1}>
        {label}
      </Text>
      <Text className="font-heading text-content mt-0.5 text-2xl">{value}</Text>
    </Pressable>
  );
};

export const HomeHeader = ({ onMenuPress, onScrollToPendingPayments }: HomeHeaderProps) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { top: topInset } = useSafeAreaInsets();
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
    <View
      className="border-divider bg-surface border-b px-6 pb-6"
      style={{ paddingTop: topInset + 8 }}>
      {/* Top Row */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-subtitle text-muted mb-1 text-sm">{greeting()}</Text>
          <AppLogo size={32} />
        </View>
        {onMenuPress && (
          <Pressable
            onPress={onMenuPress}
            className="border-divider bg-surface-raised h-10 w-10 items-center justify-center rounded-full border"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityLabel={t("common.home.menu")}
            accessibilityRole="button">
            <Ionicons
              name="menu-outline"
              size={20}
              color={colors.accent}
              accessibilityLabelHidden
            />
          </Pressable>
        )}
      </View>

      {/* Stats Cards */}
      <View className="flex-row gap-3">
        <StatCard
          icon="people-outline"
          label={t("common.home.caregivers")}
          value={caregivers.length}
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
