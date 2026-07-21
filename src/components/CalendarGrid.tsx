import React from "react";
import { View, Text, Pressable } from "react-native";
import { dateKey } from "@/utils/date";
import type { Frequency } from "@/context/ScheduleContext";

type Caregiver = { id: string; name: string; frequency: Frequency };

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
  // Create rows of 7 days each, ensuring each row has exactly 7 cells
  const rows = [];
  for (let i = 0; i < daysGrid.length; i += 7) {
    const row = daysGrid.slice(i, i + 7);
    // Pad the last row with null values to ensure it has 7 cells
    while (row.length < 7) {
      row.push(null);
    }
    rows.push(row);
  }

  return (
    <View className="w-full">
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row">
          {row.map((maybeDate, colIndex) => {
            const idx = rowIndex * 7 + colIndex;

            if (!maybeDate) {
              return <View key={`blank-${idx}`} className="aspect-square flex-1 p-1" />;
            }

            const scheduled = scheduledCaregiversForDate(maybeDate);
            const paymentStatus = getDayPaymentStatus(maybeDate);
            const isToday = dateKey(maybeDate) === dateKey(new Date());
            const isWeekend = maybeDate.getDay() === 0 || maybeDate.getDay() === 6;

            // Enhanced styling based on status
            let bgStyle: string;
            let borderStyle: string;
            let textStyle: string;

            if (scheduled.length === 0) {
              bgStyle = "bg-zinc-800/50";
              borderStyle = "border-zinc-700/50";
              textStyle = isWeekend ? "text-zinc-500" : "text-zinc-400";
            } else {
              switch (paymentStatus) {
                case "all":
                  bgStyle = "bg-emerald-500/90 shadow-lg shadow-emerald-500/20";
                  borderStyle = "border-emerald-400";
                  textStyle = "text-white font-semibold";
                  break;
                case "partial":
                  bgStyle = "bg-amber-500/90 shadow-lg shadow-amber-500/20";
                  borderStyle = "border-amber-400";
                  textStyle = "text-white font-semibold";
                  break;
                case "none":
                default:
                  bgStyle = "bg-rose-500/90 shadow-lg shadow-rose-500/20";
                  borderStyle = "border-rose-400";
                  textStyle = "text-white font-semibold";
                  break;
              }
            }

            const todayBorder = isToday ? "border-[3px] border-yellow-400" : `border-2 ${borderStyle}`;

            return (
              <View key={dateKey(maybeDate)} className="aspect-square flex-1 p-1">
                <Pressable
                  onPress={() => onDayPress(maybeDate)}
                  className="h-full w-full"
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}>
                  <View
                    className={`h-full w-full items-center justify-center rounded-xl ${bgStyle} ${todayBorder}`}>
                    {/* Day number */}
                    <Text className={`text-sm ${textStyle}`}>{maybeDate.getDate()}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};
