import { useAppTheme } from "@/theme";
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useSchedule } from "@/context/ScheduleContext";
import { useAlert } from "@/context/AlertContext";
import { useUpcomingPayments, type UpcomingPayment } from "@/hooks/useUpcomingPayments";
import { UpcomingPaymentsList } from "@/components/UpcomingPaymentsList";
import { Card } from "@/components/Card";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useRateApp } from "@/hooks/useRateApp";
import { isPaymentPending } from "@/utils/paymentUtils";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/i18n/format";

export const PaymentsScreen = () => {
  const { colors } = useAppTheme();
  // Track screen view
  useScreenTracking("Payments", "PaymentsScreen");

  const { t } = useTranslation();
  const navigation = useNavigation();
  const { top: topInset } = useSafeAreaInsets();
  const { markPaidForPeriod, caregivers } = useSchedule();
  const { showAlert } = useAlert();
  const upcomingPayments = useUpcomingPayments();
  const { incrementActionCount } = useRateApp();
  const [refreshing, setRefreshing] = useState(false);

  // Pending = due today or overdue; upcoming = not due yet
  const pendingPayments = useMemo(
    () => upcomingPayments.filter((payment) => isPaymentPending(payment)),
    [upcomingPayments],
  );
  const upcoming = useMemo(
    () => upcomingPayments.filter((payment) => !isPaymentPending(payment)),
    [upcomingPayments],
  );

  const handleMarkPaid = async (item: UpcomingPayment) => {
    try {
      await markPaidForPeriod(item.caregiverId, item.periodKey, item.frequency);
      incrementActionCount();
      showAlert({
        title: t("payments.registered"),
        message: t("payments.registeredMessage", { name: item.caregiver }),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } catch (error) {
      console.error("Error marking payment:", error);
      // Unreadable rates: retrying won't help, so say why
      const locked = caregivers.find((cg) => cg.id === item.caregiverId)?.locked;
      showAlert({
        title: t("common.error"),
        message: locked ? t("errors.ratesUnavailable") : t("payments.registerError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Brief delay to show refresh indicator - data updates automatically via listeners
    setTimeout(() => setRefreshing(false), 500);
  };

  const totalPendingAmount = pendingPayments.reduce((sum, item) => sum + item.amount, 0);
  const totalUpcomingAmount = upcoming.reduce((sum, item) => sum + item.amount, 0);
  const hasLockedRates = caregivers.some((caregiver) => caregiver.locked);

  return (
    <View className="bg-app flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: topInset + 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }>
        <View className="px-4">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-content mb-2 text-3xl font-bold">{t("payments.title")}</Text>
            <Text className="text-muted">{t("payments.subtitle")}</Text>
          </View>

          {/* Pending Payments Section */}
          {hasLockedRates && (
            <Text testID="payment-rates-unavailable" className="text-warning mb-4">
              {t("errors.ratesUnavailable")}
            </Text>
          )}
          <View className="mb-8">
            <View className="mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text className="text-content flex-1 text-xl font-semibold">
                  {t("payments.pendingTitle")}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-muted text-sm">
                  {t("payments.items", { count: pendingPayments.length })}
                </Text>
                <Text className="text-content text-lg font-bold">
                  {formatMoney(totalPendingAmount)}
                </Text>
              </View>
            </View>

            {pendingPayments.length > 0 ? (
              <UpcomingPaymentsList items={pendingPayments} onMarkPaid={handleMarkPaid} />
            ) : (
              <Card variant="elevated">
                <View className="items-center p-4">
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                  <Text className="text-content mt-2 text-lg font-semibold">
                    {t("payments.nonePending")}
                  </Text>
                  <Text className="text-muted mt-1 text-center">
                    {hasLockedRates ? t("errors.ratesUnavailable") : t("payments.allUpToDate")}
                  </Text>
                </View>
              </Card>
            )}
          </View>

          {/* Upcoming Payments Section */}
          <View className="mb-8">
            <View className="mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar" size={20} color={colors.info} />
                <Text className="text-content flex-1 text-xl font-semibold">
                  {t("payments.upcomingTitle")}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-muted text-sm">
                  {t("payments.items", { count: upcoming.length })}
                </Text>
                <Text className="text-content text-lg font-bold">
                  {formatMoney(totalUpcomingAmount)}
                </Text>
              </View>
            </View>

            {upcoming.length > 0 ? (
              <UpcomingPaymentsList items={upcoming} onMarkPaid={handleMarkPaid} />
            ) : (
              <Card variant="elevated">
                <View className="items-center p-4">
                  <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                  <Text className="text-content mt-2 text-lg font-semibold">
                    {t("payments.noneUpcoming")}
                  </Text>
                  <Text className="text-muted mt-1 text-center">
                    {t("payments.nothingScheduled")}
                  </Text>
                </View>
              </Card>
            )}
          </View>

          {/* Quick Actions */}
          <View className="mb-6">
            <Text className="text-content mb-4 text-lg font-semibold">
              {t("payments.quickActions")}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => navigation.navigate("DayCalendar" as never)}
                className="bg-primary flex-1 items-center rounded-lg p-4">
                <Ionicons name="calendar-outline" size={24} color={colors.onPrimary} />
                <Text className="text-on-primary mt-2 font-semibold">
                  {t("common.tabs.calendar")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("History" as never)}
                className="bg-primary flex-1 items-center rounded-lg p-4">
                <Ionicons name="time-outline" size={24} color={colors.onPrimary} />
                <Text className="text-on-primary mt-2 font-semibold">
                  {t("common.tabs.history")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
