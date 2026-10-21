import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UpcomingPayment } from "@/hooks/useUpcomingPayments";
import { useTranslation } from "react-i18next";
import { formatMoney, frequencyLabel, localizedDescription } from "@/i18n/format";
import { useAppTheme } from "@/theme";

type Props = {
  items: UpcomingPayment[];
  onMarkPaid: (item: UpcomingPayment) => Promise<void>;
};

export const UpcomingPaymentsList = ({ items, onMarkPaid }: Props) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const activeTimers = timers.current;
    return () => {
      mounted.current = false;
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);

  const handleMarkPaid = async (item: UpcomingPayment) => {
    // Add to loading state
    setLoadingItems((prev) => new Set(prev).add(item.id));

    try {
      await onMarkPaid(item);
      if (!mounted.current) return;

      // Add to animating state and start slide-out animation
      setAnimatingItems((prev) => new Set(prev).add(item.id));

      // Remove from loading state
      setLoadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });

      // Remove from animating state after animation completes
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setAnimatingItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
      }, 300);
      timers.current.add(timer);
    } catch (error) {
      if (!mounted.current) return;
      // Remove from loading state on error
      setLoadingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
      console.error("Error marking payment as paid:", error);
    }
  };

  return (
    <View className="mt-2">
      <View className="gap-3">
        {items.map((item) => {
          const isLoading = loadingItems.has(item.id);
          const isAnimating = animatingItems.has(item.id);

          return (
            <Animated.View
              key={item.id}
              className="border-divider bg-surface w-full rounded-xl border p-4"
              style={{
                transform: [
                  {
                    translateX: isAnimating ? -400 : 0,
                  },
                ],
                opacity: isAnimating ? 0 : 1,
              }}>
              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="mb-1 flex-row items-center gap-2">
                    <Text className="font-heading text-content">{item.caregiver}</Text>
                    <Text className="text-muted text-xs">({frequencyLabel(item.frequency)})</Text>
                  </View>
                  <Text className="text-muted text-xs">
                    {localizedDescription(item.description)}
                  </Text>
                  <View className="mt-1 flex-row gap-3">
                    {item.dayShifts > 0 && (
                      <Text className="text-subtle text-xs">
                        {t("common.daysCount", { count: item.dayShifts })}
                      </Text>
                    )}
                    {item.nightShifts > 0 && (
                      <Text className="text-subtle text-xs">
                        {t("common.nightsCount", { count: item.nightShifts })}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-heading text-content text-lg">
                    {formatMoney(item.amount)}
                  </Text>
                  {item.additionalAmount !== undefined && item.additionalAmount > 0 && (
                    <View className="mt-1 items-end">
                      <Text className="text-muted text-[10px]">
                        {t("payments.regularAmount")}: {formatMoney(item.regularAmount ?? 0)}
                      </Text>
                      <Text className="text-accent text-[10px]">
                        {t("payments.additionalAmount")}
                        {item.additionalCount ? ` (${item.additionalCount})` : ""}:{" "}
                        {formatMoney(item.additionalAmount)}
                      </Text>
                    </View>
                  )}
                  <View className="bg-danger-soft mt-1 rounded px-2 py-1">
                    <Text className="text-danger text-xs">{t("common.pending")}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => handleMarkPaid(item)}
                disabled={isLoading}
                className={`w-full flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 ${
                  isLoading ? "bg-disabled" : "bg-emerald-600"
                }`}
                style={({ pressed }) => ({
                  opacity: pressed && !isLoading ? 0.8 : 1,
                })}>
                {isLoading ? (
                  <>
                    <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                    <Text className="font-subtitle text-muted text-center">
                      {t("common.processing")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.onPrimary} />
                    <Text className="font-subtitle text-center text-white">
                      {t("payments.markAsPaid")}
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};
