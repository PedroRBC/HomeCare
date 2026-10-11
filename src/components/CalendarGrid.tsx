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
    <View className="w-full gap-[5px]">
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row gap-1">
          {row.map((maybeDate, colIndex) => {
            const idx = rowIndex * 7 + colIndex;

            if (!maybeDate) {
              return <View key={`blank-${idx}`} className="h-[43px] flex-1" />;
            }

            const dayNumber = maybeDate.getDate();
            const scheduled = scheduledCaregiversForDate(maybeDate);
            const paymentStatus = getDayPaymentStatus(maybeDate);
            const isToday = dateKey(maybeDate) === dateKey(new Date());

            // Status colors follow the semantic theme tokens
            let bgStyle: string;
            let textStyle: string;
            let dotStyle = "";

            if (scheduled.length === 0) {
              bgStyle = "bg-surface";
              textStyle = "text-content";
            } else {
              switch (paymentStatus) {
                case "all":
                  bgStyle = "bg-success-soft";
                  textStyle = "text-success font-subtitle";
                  dotStyle = "bg-success";
                  break;
                case "partial":
                  bgStyle = "bg-warning-soft";
                  textStyle = "text-warning font-subtitle";
                  dotStyle = "bg-warning";
                  break;
                case "none":
                default:
                  bgStyle = "bg-danger-soft";
                  textStyle = "text-danger font-subtitle";
                  dotStyle = "bg-danger";
                  break;
              }
            }

            const todayBorder = isToday ? "border-[1.5px] border-warning" : "";
            const todayText = isToday ? "font-subtitle" : "";

            return (
              <Pressable
                key={dateKey(maybeDate)}
                onPress={() => onDayPress(maybeDate)}
                accessibilityRole="button"
                accessibilityLabel={String(dayNumber)}
                className={`h-[43px] flex-1 items-center justify-center rounded-[10px] ${bgStyle} ${todayBorder}`}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <View className="items-center gap-0.5">
                  {/* Day number */}
                  <Text className={`text-sm ${textStyle} ${todayText}`}>{dayNumber}</Text>
                  {dotStyle !== "" && <View className={`h-1 w-1 rounded-full ${dotStyle}`} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};
