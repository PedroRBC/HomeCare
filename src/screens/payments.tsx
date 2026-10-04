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

export const PaymentsScreen = () => {
  // Track screen view
  useScreenTracking("Payments", "PaymentsScreen");

  const navigation = useNavigation();
  const { top: topInset } = useSafeAreaInsets();
  const { markPaidForPeriod } = useSchedule();
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
        title: "Pagamento Registrado",
        message: `Pagamento de ${item.caregiver} registrado com sucesso!`,
        icon: "checkmark-circle",
        iconColor: "#059669",
        buttons: [{ text: "OK", style: "default" }],
      });
    } catch (error) {
      console.error("Error marking payment:", error);
      showAlert({
        title: "Erro",
        message: "Não foi possível registrar o pagamento. Tente novamente.",
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: "OK", style: "default" }],
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

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: topInset + 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View className="px-4">
          {/* Header */}
          <View className="mb-6">
            <Text className="mb-2 text-3xl font-bold text-white">Pagamentos</Text>
            <Text className="text-zinc-400">Gerencie pagamentos pendentes e futuros</Text>
          </View>

          {/* Pending Payments Section */}
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text className="text-xl font-semibold text-white">Pagamentos Pendentes</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-zinc-400">
                  {pendingPayments.length} {pendingPayments.length === 1 ? "item" : "itens"}
                </Text>
                <Text className="text-lg font-bold text-red-400">
                  R$ {totalPendingAmount.toFixed(2).replace(".", ",")}
                </Text>
              </View>
            </View>

            {pendingPayments.length > 0 ? (
              <UpcomingPaymentsList items={pendingPayments} onMarkPaid={handleMarkPaid} />
            ) : (
              <Card variant="elevated">
                <View className="items-center p-4">
                  <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                  <Text className="mt-2 text-lg font-semibold text-white">
                    Nenhum pagamento pendente
                  </Text>
                  <Text className="mt-1 text-center text-zinc-400">
                    Todos os pagamentos estão em dia!
                  </Text>
                </View>
              </Card>
            )}
          </View>

          {/* Upcoming Payments Section */}
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar" size={20} color="#3B82F6" />
                <Text className="text-xl font-semibold text-white">Próximos Pagamentos</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-zinc-400">
                  {upcoming.length} {upcoming.length === 1 ? "item" : "itens"}
                </Text>
                <Text className="text-lg font-bold text-blue-400">
                  R$ {totalUpcomingAmount.toFixed(2).replace(".", ",")}
                </Text>
              </View>
            </View>

            {upcoming.length > 0 ? (
              <UpcomingPaymentsList items={upcoming} onMarkPaid={handleMarkPaid} />
            ) : (
              <Card variant="elevated">
                <View className="items-center p-4">
                  <Ionicons name="calendar-outline" size={48} color="#6B7280" />
                  <Text className="mt-2 text-lg font-semibold text-white">
                    Nenhum pagamento futuro
                  </Text>
                  <Text className="mt-1 text-center text-zinc-400">
                    Não há pagamentos programados
                  </Text>
                </View>
              </Card>
            )}
          </View>

          {/* Quick Actions */}
          <View className="mb-6">
            <Text className="mb-4 text-lg font-semibold text-white">Ações Rápidas</Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => navigation.navigate("DayCalendar" as never)}
                className="flex-1 items-center rounded-lg bg-emerald-600 p-4">
                <Ionicons name="calendar-outline" size={24} color="white" />
                <Text className="mt-2 font-semibold text-white">Calendário</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("History" as never)}
                className="flex-1 items-center rounded-lg bg-blue-600 p-4">
                <Ionicons name="time-outline" size={24} color="white" />
                <Text className="mt-2 font-semibold text-white">Histórico</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
