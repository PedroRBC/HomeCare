import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import type { PaymentHistory } from "@/context/ScheduleContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { periodFromDescription } from "@/utils/paymentHistory";
import { useAlert } from "@/context/AlertContext";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";
import { dateKey } from "@/utils/date";

type RouteParams = { payment: PaymentHistory };

export const PaymentDetailsScreen = () => {
  // Track screen view
  useScreenTracking("PaymentDetails", "PaymentDetailsScreen");

  const route = useRoute();
  const navigation = useNavigation();
  const { payment } = route.params as RouteParams;
  const { deletePaymentHistory, scheduleByDay, caregivers } = useSchedule();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const handleDeletePayment = async () => {
    showAlert({
      title: "Confirmar Exclusão",
      message: `Tem certeza que deseja excluir este pagamento?\n\n${payment.caregiverName} - ${payment.description}\nR$ ${payment.amount.toFixed(2).replace(".", ",")}`,
      icon: "trash",
      iconColor: "#ef4444",
      buttons: [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePaymentHistory(payment.id);
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting payment:", error);
              showAlert({
                title: "Erro",
                message: "Não foi possível excluir o pagamento. Tente novamente.",
                icon: "alert-circle",
                iconColor: "#ef4444",
                buttons: [
                  {
                    text: "OK",
                    style: "default",
                  },
                ],
              });
            }
          },
        },
      ],
    });
  };

  // Function to get exact days and shifts for the payment
  const getExactPaymentDays = useMemo(() => {
    const caregiver = caregivers.find((c) => c.id === payment.caregiverId);
    if (!caregiver) return [];

    const exactDays: { date: string; shift: "day" | "night"; amount: number }[] = [];

    // Extract period information from description
    const description = payment.description;

    // Check if this is an extra (daily) payment
    const extraMatch = description.match(/Extra (Dia|Noite) - (\d{2}\/\d{2}\/\d{4})/);
    if (extraMatch) {
      // This is a daily extra payment - show only the specific day
      const [, shiftLabel, dateStr] = extraMatch;
      const shift = shiftLabel === "Dia" ? "day" : "night";

      // Parse the date from description (DD/MM/YYYY)
      const [day, month, year] = dateStr.split("/");
      const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12);
      const calendarKey = dateKey(targetDate);
      const daySchedule = scheduleByDay[calendarKey];

      // Verify the caregiver was actually scheduled in the extra shift
      if (daySchedule) {
        const extraList = shift === "day" ? daySchedule.dayExtra : daySchedule.nightExtra;
        if (extraList && extraList.includes(caregiver.id)) {
          exactDays.push({
            date: targetDate.toLocaleDateString("pt-BR"),
            shift,
            amount:
              shift === "day"
                ? caregiver.dayAmount || caregiver.amount
                : caregiver.nightAmount || caregiver.amount,
          });
        }
      }

      return exactDays;
    }

    const period = periodFromDescription(description);
    if (!period) return [];

    // Find all days in the period where the caregiver worked (regular shifts only)
    for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
      const calendarKey = dateKey(d);
      const daySchedule = scheduleByDay[calendarKey];

      if (daySchedule) {
        // Check day shift (regular only, not extra)
        if (daySchedule.day && daySchedule.day.includes(caregiver.id)) {
          exactDays.push({
            date: d.toLocaleDateString("pt-BR"),
            shift: "day",
            amount: caregiver.dayAmount || caregiver.amount,
          });
        }

        // Check night shift (regular only, not extra)
        if (daySchedule.night && daySchedule.night.includes(caregiver.id)) {
          exactDays.push({
            date: d.toLocaleDateString("pt-BR"),
            shift: "night",
            amount: caregiver.nightAmount || caregiver.amount,
          });
        }
      }
    }

    return exactDays;
  }, [payment, caregivers, scheduleByDay]);

  // Function to get payment details
  const getPaymentDetails = (payment: PaymentHistory) => {
    const description = payment.description;

    // Extract shift count from description if available
    const shiftMatch = description.match(/\((\d+) turnos?\)/);
    const shiftCount = shiftMatch ? parseInt(shiftMatch[1]) : getExactPaymentDays.length;

    return {
      period: description.replace(/ \(\d+ turnos?\)/, ""), // Remove shift count from description
      shiftCount,
      amount: payment.amount,
      paidAt: payment.paidAt,
      frequency: payment.frequency,
    };
  };

  const details = getPaymentDetails(payment);

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
        backgroundColor: "transparent", // Fully transparent background
      }}>
      {/* Backdrop - semi-transparent overlay */}
      <View className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
        <Pressable className="flex-1" onPress={() => navigation.goBack()} />
      </View>

      {/* Payment Details Card */}
      <Card variant="elevated" className="w-full max-w-sm">
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-600/20">
              <Ionicons name="person-outline" size={24} color="#10B981" />
            </View>
            <View>
              <Text className="font-heading text-lg text-zinc-100">{payment.caregiverName}</Text>
              <Text className="text-sm text-zinc-400">{payment.frequency}</Text>
            </View>
          </View>
          <Pressable onPress={() => navigation.goBack()} className="rounded-full bg-zinc-700 p-2">
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Payment Details */}
        <View className="mb-6">
          <Text className="mb-2 text-sm text-zinc-300">Período</Text>
          <Text className="font-subtitle text-zinc-100">{details.period}</Text>
        </View>

        <View className="mb-6">
          <Text className="mb-3 text-sm text-zinc-300">Dias Trabalhados</Text>
          {getExactPaymentDays.length > 0 ? (
            <ScrollView className="max-h-32" showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {getExactPaymentDays.map((day, index) => (
                  <View
                    key={index}
                    className="flex-row items-center justify-between rounded-lg bg-zinc-700/50 px-3 py-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm text-zinc-400">{day.date}</Text>
                      <Text className="text-sm text-zinc-300">
                        {day.shift === "day" ? "🌅 Dia" : "🌙 Noite"}
                      </Text>
                    </View>
                    <Text className="font-subtitle text-sm text-emerald-400">
                      R$ {day.amount.toFixed(2).replace(".", ",")}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text className="text-sm text-zinc-400">Nenhum dia específico encontrado</Text>
          )}
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-sm text-zinc-300">Valor Total</Text>
          <Text className="font-heading text-2xl text-emerald-400">
            R$ {details.amount.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-sm text-zinc-300">Data do Pagamento</Text>
          <Text className="font-subtitle text-zinc-100">
            {new Date(details.paidAt).toLocaleDateString("pt-BR")} às{" "}
            {new Date(details.paidAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Delete Button */}
        <Pressable
          onPress={handleDeletePayment}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-4"
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}>
          <Ionicons name="trash-outline" size={20} color="white" />
          <Text className="font-subtitle text-white">Excluir Pagamento</Text>
        </Pressable>
      </Card>
    </View>
  );
};
