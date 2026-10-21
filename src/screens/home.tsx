import { useAppTheme } from "@/theme";
import React, { useMemo, useState, useRef } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { CalendarHeader } from "@/components/CalendarHeader";
import { WeekdayHeader } from "@/components/WeekdayHeader";
import { CalendarGrid } from "@/components/CalendarGrid";
import { Legend } from "@/components/Legend";
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { ScheduleLoadState } from "@/components/ScheduleLoadState";
import { NotificationStatus } from "@/components/NotificationStatus";
import { HomeHeader, HomeOverview } from "@/components/HomeHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { calculatePendingPayments } from "@/utils/paymentUtils";
import { useTranslation } from "react-i18next";
import { formatMonthYear } from "@/i18n/format";
import { useAppNavigation } from "@/hooks/useAppNavigation";

function useScheduleSelectors() {
  const {
    caregivers,
    getScheduledCaregivers,
    getExtraScheduledCaregivers,
    getAdditionalScheduledCaregivers,
    isPaidForCaregiverShift,
  } = useSchedule();

  function scheduledCaregiversForDate(date: Date) {
    const regular = getScheduledCaregivers(date);
    const extras = getExtraScheduledCaregivers(date);
    const uniqueById = new Map([...regular, ...extras].map((cg) => [cg.id, cg]));
    return Array.from(uniqueById.values());
  }

  function getDayPaymentStatus(date: Date): "none" | "partial" | "all" {
    const paid = (["day", "night"] as const).flatMap((shift) => [
      ...getScheduledCaregivers(date, shift).map((cg) => isPaidForCaregiverShift(cg, date, shift)),
      ...getExtraScheduledCaregivers(date, shift).map((cg) =>
        isPaidForCaregiverShift(cg, date, shift, "daily-extra"),
      ),
      ...getAdditionalScheduledCaregivers(date, shift).map((cg) =>
        isPaidForCaregiverShift(cg, date, shift, "additional"),
      ),
    ]);

    if (!paid.includes(true)) return "none";
    return paid.includes(false) ? "partial" : "all";
  }

  return { caregivers, scheduledCaregiversForDate, getDayPaymentStatus };
}

export const HomeScreen = () => {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  // Track screen view
  useScreenTracking("Home", "HomeScreen");

  const scrollViewRef = useRef<ScrollView>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Pan gesture animation values using modern API
  const translateX = useSharedValue(0);

  const { scheduledCaregiversForDate, getDayPaymentStatus, caregivers } = useScheduleSelectors();
  const upcomingPayments = useUpcomingPayments();

  // Calculate pending payments using the same logic as payments screen
  const pendingPayments = useMemo(() => {
    return calculatePendingPayments(upcomingPayments);
  }, [upcomingPayments]);

  const { daysGrid, monthLabel } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0-6 Sun-Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const leadingBlanks = firstWeekday; // start week on Sunday
    const cells: (Date | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    const label = formatMonthYear(currentMonth);
    return { daysGrid: cells, monthLabel: label };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- label depends on the active language
  }, [currentMonth, i18n.language]);

  function prevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  // Modern pan gesture implementation
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;

      // More sensitive thresholds for faster response
      const isSwipeLeft = translationX < -30 || velocityX < -300;
      const isSwipeRight = translationX > 30 || velocityX > 300;

      if (isSwipeLeft) {
        // Swipe left - go to next month
        runOnJS(nextMonth)();
      } else if (isSwipeRight) {
        // Swipe right - go to previous month
        runOnJS(prevMonth)();
      }

      // Use withTiming for instant response instead of spring
      translateX.value = withTiming(0, {
        duration: 150, // Very fast animation
      });
    });

  // Animated style for the calendar
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // Removed modal state in favor of navigation

  const navigation = useNavigation<any>();
  // Back to the house list, where caregivers also find their own schedule
  const { navigateToHouseManagement } = useAppNavigation();
  function onDayPress(d: Date) {
    navigation.navigate("DayDetails", { date: d.toISOString() });
  }

  const { isFirestoreConnected, hasLoadError, retryLoad } = useSchedule();
  if (!isFirestoreConnected) {
    return (
      <View className="bg-app flex-1">
        <HomeHeader />
        <ScheduleLoadState failed={hasLoadError} onRetry={retryLoad} />
      </View>
    );
  }

  return (
    <View className="bg-app flex-1">
      <HomeHeader />

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-[22px]">
          <HomeOverview onMenuPress={navigateToHouseManagement} />

          {caregivers.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title={t("home.noCaregivers")}
              description={t("home.noCaregiversHint")}
              actionText={t("home.addCaregiver")}
              onActionPress={() => navigation.navigate("Create")}
            />
          ) : (
            <>
              <NotificationStatus />

              {/* Calendar Section */}
              <View className="gap-3">
                <Text className="font-subtitle text-content text-base">
                  {t("home.paymentCalendar")}
                </Text>
                <View className="bg-surface border-divider overflow-hidden rounded-[20px] border p-4">
                  <GestureDetector gesture={panGesture}>
                    <Animated.View style={animatedStyle}>
                      <CalendarHeader
                        monthLabel={monthLabel}
                        onPrev={prevMonth}
                        onNext={nextMonth}
                        onToday={() =>
                          setCurrentMonth(
                            new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                          )
                        }
                      />
                      <WeekdayHeader />
                      <CalendarGrid
                        daysGrid={daysGrid}
                        getDayPaymentStatus={getDayPaymentStatus}
                        scheduledCaregiversForDate={scheduledCaregiversForDate}
                        onDayPress={onDayPress}
                      />
                      <Legend />
                    </Animated.View>
                  </GestureDetector>
                </View>
              </View>

              {/* Pending Payments Alert */}
              {pendingPayments.length > 0 && (
                <Card variant="elevated">
                  <Pressable
                    onPress={() => navigation.navigate("Payments")}
                    className="flex-row items-center justify-between p-4"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.8 : 1,
                    })}>
                    <View className="flex-1 flex-row items-center gap-3">
                      <View className="bg-danger-soft rounded-full p-2">
                        <Ionicons name="alert-circle" size={24} color={colors.danger} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-subtitle text-content">
                          {t("home.pendingPayments", { count: pendingPayments.length })}
                        </Text>
                        <Text className="text-muted mt-1 text-sm">{t("home.tapToManage")}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </Pressable>
                </Card>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
