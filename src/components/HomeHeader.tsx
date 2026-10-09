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
        <Pressable
          onPress={() => navigation.navigate("Caregivers")}
          className="border-primary-soft bg-primary-soft flex-1 rounded-xl border p-4"
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
          <View className="mb-2 flex-row items-center justify-between">
            <Ionicons name="people-outline" size={20} color={colors.accent} />
            <Text className="text-muted text-xs">{t("common.home.caregivers")}</Text>
          </View>
          <Text className="font-heading text-content text-2xl">{caregivers.length}</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("History")}
          className="border-divider bg-surface-raised flex-1 rounded-xl border p-4"
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
          <View className="mb-2 flex-row items-center justify-between">
            <Ionicons name="card-outline" size={20} color={colors.accent} />
            <Text className="text-muted text-xs">{t("common.home.payments")}</Text>
          </View>
          <Text className="font-heading text-content text-2xl">{paymentHistory.length}</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Payments")}
          className="border-divider bg-surface-raised flex-1 rounded-xl border p-4"
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
          <View className="mb-2 flex-row items-center justify-between">
            <Ionicons name="time-outline" size={20} color={colors.accent} />
            <Text className="text-muted text-xs">{t("common.home.pending")}</Text>
          </View>
          <Text className="font-heading text-content text-2xl">{totalPendingPayments}</Text>
        </Pressable>
      </View>
    </View>
  );
};
