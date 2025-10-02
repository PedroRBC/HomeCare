import React, { useMemo, useState, useRef } from "react";
import { View, ScrollView, Text } from "react-native";
import { CalendarHeader } from "@/components/CalendarHeader";
import { WeekdayHeader } from "@/components/WeekdayHeader";
import { CalendarGrid } from "@/components/CalendarGrid";
import { Legend } from "@/components/Legend";
import { UpcomingPaymentsList } from "@/components/UpcomingPaymentsList";
// date helpers not needed directly here
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { NotificationStatus } from "@/components/NotificationStatus";
import { NotificationDebug } from "@/components/NotificationDebug";
import { HomeHeader } from "@/components/HomeHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";

// caregivers and payments now come from context

function useScheduleSelectors() {
  const { caregivers, getScheduledCaregivers, isPaidForCaregiverShift } = useSchedule();
  function scheduledCaregiversForDate(date: Date) {
    return getScheduledCaregivers(date);
  }
  function isDayPaidForAllCaregivers(date: Date) {
    const dayCaregivers = getScheduledCaregivers(date, "day");
    const nightCaregivers = getScheduledCaregivers(date, "night");

    if (dayCaregivers.length === 0 && nightCaregivers.length === 0) return false;

    const dayPaid = dayCaregivers.every((cg) => isPaidForCaregiverShift(cg, date, "day"));
    const nightPaid = nightCaregivers.every((cg) => isPaidForCaregiverShift(cg, date, "night"));

    return dayPaid && nightPaid;
  }
  function getDayPaymentStatus(date: Date): "none" | "partial" | "all" {
    const dayCaregivers = getScheduledCaregivers(date, "day");
    const nightCaregivers = getScheduledCaregivers(date, "night");
    const allScheduled = getScheduledCaregivers(date);

    if (allScheduled.length === 0) return "none";

    let paidShifts = 0;
    let totalShifts = 0;

    // Count day shifts
    dayCaregivers.forEach((cg) => {
      totalShifts++;
      if (isPaidForCaregiverShift(cg, date, "day")) paidShifts++;
    });

    // Count night shifts
    nightCaregivers.forEach((cg) => {
      totalShifts++;
      if (isPaidForCaregiverShift(cg, date, "night")) paidShifts++;
    });

    if (paidShifts === 0) return "none";
    if (paidShifts === totalShifts) return "all";
    return "partial";
  }
  return { caregivers, scheduledCaregiversForDate, isDayPaidForAllCaregivers, getDayPaymentStatus };
}

export const HomeScreen = () => {
  // Track screen view
  useScreenTracking("Home", "HomeScreen");

  const scrollViewRef = useRef<ScrollView>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { scheduledCaregiversForDate, getDayPaymentStatus, caregivers } = useScheduleSelectors();
  const { markPaidForPeriod } = useSchedule();
  const upcomingPayments = useUpcomingPayments();

  const { daysGrid, monthLabel } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0-6 Sun-Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const leadingBlanks = firstWeekday; // start week on Sunday
    const cells: (Date | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    const label = currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { daysGrid: cells, monthLabel: label };
  }, [currentMonth]);

  function prevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  // Removed modal state in favor of navigation

  const navigation = useNavigation<any>();
  function onDayPress(d: Date) {
    navigation.navigate("DayDetails", { date: d.toISOString() });
  }

  // Toggling handled inside DayDetails screen via context

  async function handleMarkPaid(item: {
    caregiverId: string;
    periodKey: string;
    frequency: "Semanal" | "Quinzenal" | "Mensal";
  }) {
    try {
      await markPaidForPeriod(item.caregiverId, item.periodKey, item.frequency);
    } catch (error) {
      console.error("Error marking payment:", error);
      // TODO: Show error message to user
    }
  }

  const handleScrollToPendingPayments = () => {
    // Scroll to the pending payments section
    // We'll scroll to a position that shows the "Pagamentos Pendentes" section
    scrollViewRef.current?.scrollTo({ y: 400, animated: true });
  };

  return (
    <View className="flex-1 bg-zinc-900">
      <HomeHeader onScrollToPendingPayments={handleScrollToPendingPayments} />
      <ConnectionStatus />

      {caregivers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Nenhum cuidador cadastrado"
          description="Comece adicionando sua primeira cuidadora para começar a gerenciar os pagamentos."
          actionText="Adicionar Cuidadora"
          onActionPress={() => navigation.navigate("Adicionar" as never)}
        />
      ) : (
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <NotificationStatus />
            {__DEV__ && <NotificationDebug />}

            {/* Calendar Section */}
            <Card variant="elevated">
              <CalendarHeader monthLabel={monthLabel} onPrev={prevMonth} onNext={nextMonth} />
              <WeekdayHeader />
              <CalendarGrid
                daysGrid={daysGrid}
                getDayPaymentStatus={getDayPaymentStatus}
                scheduledCaregiversForDate={scheduledCaregiversForDate}
                onDayPress={onDayPress}
              />
              <Legend />
            </Card>

            {/* Payments Section */}
            <View>
              <Text className="font-heading mb-4 text-lg text-zinc-200">Pagamentos Pendentes</Text>
              {upcomingPayments.length === 0 ? (
                <Card>
                  <View className="items-center py-8">
                    <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
                    <Text className="font-subtitle mt-3 text-zinc-300">
                      Todos os pagamentos estão em dia!
                    </Text>
                  </View>
                </Card>
              ) : (
                <UpcomingPaymentsList items={upcomingPayments} onMarkPaid={handleMarkPaid} />
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};
