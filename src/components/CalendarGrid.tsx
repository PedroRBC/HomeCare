import React from "react";
import { View, Text, Pressable } from "react-native";
import { dateKey } from "@/utils/date";

type Caregiver = { id: string; name: string; frequency: "Semanal" | "Quinzenal" | "Mensal" };

type Props = {
  daysGrid: (Date | null)[];
  getDayPaymentStatus: (date: Date) => "none" | "partial" | "all";
  scheduledCaregiversForDate: (date: Date) => Caregiver[];
  onDayPress: (date: Date) => void;
};

export const CalendarGrid = ({
  daysGrid,
  getDayPaymentStatus,
  scheduledCaregiversForDate,
  onDayPress,
}: Props) => {
  return (
    <View className="flex-row flex-wrap">
      {daysGrid.map((maybeDate, idx) => {
        if (!maybeDate) return <View key={`b-${idx}`} className="aspect-square w-1/7" />;
        const scheduled = scheduledCaregiversForDate(maybeDate);
        const paymentStatus = getDayPaymentStatus(maybeDate);
        const isToday = dateKey(maybeDate) === dateKey(new Date());

        let baseColor: string;
        if (scheduled.length === 0) {
          baseColor = "bg-zinc-700 border-zinc-600";
        } else {
          switch (paymentStatus) {
            case "all":
              baseColor = "bg-emerald-500 border-emerald-600";
              break;
            case "partial":
              baseColor = "bg-amber-500 border-amber-600";
              break;
            case "none":
            default:
              baseColor = "bg-rose-500 border-rose-600";
              break;
          }
        }

        return (
          <Pressable
            key={dateKey(maybeDate)}
            className="w-1/7 p-1"
            onPress={() => onDayPress(maybeDate)}>
            <View
              className={`aspect-square items-center justify-center rounded-lg border ${baseColor} ${isToday ? "ring-1 ring-yellow-300 ring-offset-1 ring-offset-zinc-900" : ""}`}>
              <Text className="font-subtitle text-white">{maybeDate.getDate()}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};
