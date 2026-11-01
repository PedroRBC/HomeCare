import { useAppTheme } from "@/theme";
import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSchedule, type Caregiver, type ShiftType } from "@/context/ScheduleContext";
import { useAlert } from "@/context/AlertContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { formatDate, formatMoney, frequencyLabel } from "@/i18n/format";
import { dateKey, parseCalendarDate } from "@/utils/date";
import { shiftKey } from "@/utils/caregiverShifts";
import { getAdditionalPaymentError } from "@/utils/additionalPaymentErrors";
import { useCaregiverAvailability } from "@/hooks/useCaregiverLinks";
import { useHouse } from "@/context/HouseContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainAppStackParamList } from "@/router/types";

type RouteParams = { date: string };

export const DayDetailsScreen = () => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<MainAppStackParamList>>();
  const { currentHouse } = useHouse();
  const { date: dateStr } = route.params as RouteParams;
  const date = useMemo(() => parseCalendarDate(dateStr), [dateStr]);

  // Track screen view
  useScreenTracking("DayDetails", "DayDetailsScreen");

  const {
    caregivers,
    getScheduledCaregivers,
    getExtraScheduledCaregivers,
    getAdditionalScheduledCaregivers,
    toggleShiftAssignment,
    toggleExtraShiftAssignment,
    toggleShiftAdditional,
    isPaidForCaregiverShift,
  } = useSchedule();
  const { showAlert } = useAlert();
  const { isBusy: isBusyElsewhere, isUnknown: availabilityUnknown } = useCaregiverAvailability();
  const busyIn = (cg: Caregiver, shift: ShiftType) =>
    isBusyElsewhere(cg.email, shiftKey(dateKey(date), shift));

  // Changes only show once saved, so a failed one must be reported
  const showToggleError = (error?: unknown) => {
    const serviceError = getAdditionalPaymentError(error);
    const localized = serviceError ? t(`errors.${serviceError}`) : t("dayDetails.toggleError");
    showAlert({
      title: t("common.error"),
      message: localized,
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  };
  const dayCaregivers = getScheduledCaregivers(date, "day");
  const nightCaregivers = getScheduledCaregivers(date, "night");
  const dayExtraCaregivers = getExtraScheduledCaregivers(date, "day");
  const nightExtraCaregivers = getExtraScheduledCaregivers(date, "night");
  const dayAdditionalCaregivers = getAdditionalScheduledCaregivers(date, "day");
  const nightAdditionalCaregivers = getAdditionalScheduledCaregivers(date, "night");
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  // Animation values
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Reset animation values when date changes
  React.useEffect(() => {
    translateX.value = 0;
    opacity.value = 1;
  }, [dateStr, translateX, opacity]);

  // Navigation functions
  const goToPreviousDay = () => {
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    (navigation as any).navigate("DayDetails", { date: previousDay.toISOString() });
  };

  const goToNextDay = () => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    (navigation as any).navigate("DayDetails", { date: nextDay.toISOString() });
  };

  // Swipe gesture handlers - only for horizontal swipes
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      // Only respond to horizontal movement
      if (Math.abs(event.translationX) > Math.abs(event.translationY) * 2) {
        translateX.value = event.translationX;
        opacity.value = Math.max(0.5, 1 - Math.abs(event.translationX) / 180);
      }
    })
    .onEnd((event) => {
      const threshold = 60;
      const velocity = event.velocityX;

      // Only trigger if it's primarily a horizontal gesture
      if (Math.abs(event.translationX) > Math.abs(event.translationY) * 2) {
        if (event.translationX > threshold || velocity > 300) {
          // Swipe right - go to previous day
          // Show animation first, then navigate
          translateX.value = withSpring(200, { damping: 20, stiffness: 300 });
          opacity.value = withSpring(0.5, { damping: 20, stiffness: 300 }, () => {
            runOnJS(goToPreviousDay)();
          });
        } else if (event.translationX < -threshold || velocity < -300) {
          // Swipe left - go to next day
          // Show animation first, then navigate
          translateX.value = withSpring(-200, { damping: 20, stiffness: 300 });
          opacity.value = withSpring(0.5, { damping: 20, stiffness: 300 }, () => {
            runOnJS(goToNextDay)();
          });
        } else {
          // Return to center
          translateX.value = withSpring(0, { damping: 15, stiffness: 300 });
          opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
        }
      } else {
        // Reset if it's not a horizontal gesture
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
        opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
      }
    });

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  return (
    <View
      className="bg-app flex-1 px-6"
      style={{
        paddingTop: topInset + 8,
        paddingBottom: bottomInset + 8,
      }}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ gap: 16 }}
            showsVerticalScrollIndicator={false}>
            {/* Header with Navigation */}
            <View className="mt-2">
              <View className="mb-4 flex-row items-center justify-between">
                <Pressable
                  onPress={goToPreviousDay}
                  className="bg-surface-raised h-10 w-10 items-center justify-center rounded-full"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}>
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </Pressable>

                <View className="flex-1 items-center">
                  <Text className="font-heading text-content text-2xl">{formatDate(date)}</Text>
                  <Text className="text-muted text-sm">{t("dayDetails.subtitle")}</Text>
                </View>

                <Pressable
                  onPress={goToNextDay}
                  className="bg-surface-raised h-10 w-10 items-center justify-center rounded-full"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {availabilityUnknown && (
              <Text testID="availability-unknown" className="text-muted text-xs">
                {t("caregiverView.availabilityUnknown")}
              </Text>
            )}

            {currentHouse &&
              (["day", "night"] as const).map((shift) => (
                <Pressable
                  key={shift}
                  accessibilityRole="button"
                  testID={`shift-notes-${shift}`}
                  onPress={() =>
                    navigation.navigate("ShiftNotes", {
                      houseId: currentHouse.id,
                      date: dateKey(date),
                      shift,
                    })
                  }
                  className="bg-primary-soft min-h-[48px] justify-center rounded-xl px-4 py-3">
                  <Text className="text-accent font-subtitle">
                    {t("shiftNotes.title")} · {t(`common.${shift}`)}
                  </Text>
                </Pressable>
              ))}

            {caregivers.map((cg) => {
              const isDayScheduled = dayCaregivers.some((c) => c.id === cg.id);
              const isNightScheduled = nightCaregivers.some((c) => c.id === cg.id);
              const isDayExtraScheduled = dayExtraCaregivers.some((c) => c.id === cg.id);
              const isNightExtraScheduled = nightExtraCaregivers.some((c) => c.id === cg.id);
              const isDayAdditionalScheduled = dayAdditionalCaregivers.some((c) => c.id === cg.id);
              const isNightAdditionalScheduled = nightAdditionalCaregivers.some(
                (c) => c.id === cg.id,
              );
              const isDayAdditionalPaid =
                isDayAdditionalScheduled && isPaidForCaregiverShift(cg, date, "day", "additional");
              const isNightAdditionalPaid =
                isNightAdditionalScheduled &&
                isPaidForCaregiverShift(cg, date, "night", "additional");
              const isDayPaid = isDayScheduled && isPaidForCaregiverShift(cg, date, "day");
              const isNightPaid = isNightScheduled && isPaidForCaregiverShift(cg, date, "night");
              const isDayExtraPaid =
                isDayExtraScheduled && isPaidForCaregiverShift(cg, date, "day", "daily-extra");
              const isNightExtraPaid =
                isNightExtraScheduled && isPaidForCaregiverShift(cg, date, "night", "daily-extra");

              const isDisabled = cg.disabled;

              return (
                <View key={cg.id} className="border-divider overflow-hidden rounded-xl border">
                  {/* Caregiver Header */}
                  <View className={`px-4 py-3 ${isDisabled ? "bg-surface-raised" : "bg-surface"}`}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={`font-subtitle text-base ${isDisabled ? "text-muted" : "text-content"}`}>
                          {cg.name}
                        </Text>
                        {isDisabled && (
                          <View className="bg-disabled/20 rounded px-2 py-1">
                            <Text className="text-subtle text-xs">{t("dayDetails.disabled")}</Text>
                          </View>
                        )}
                      </View>
                      <Text className={`text-xs ${isDisabled ? "text-subtle" : "text-muted"}`}>
                        {frequencyLabel(cg.frequency)}
                      </Text>
                    </View>
                    {(busyIn(cg, "day") || busyIn(cg, "night")) && (
                      <View
                        testID="caregiver-unavailable"
                        className="bg-warning-soft mt-2 flex-row items-center gap-2 rounded-lg px-3 py-2">
                        <Ionicons name="warning" size={14} color={colors.warning} />
                        <Text className="text-warning flex-1 text-xs">
                          {busyIn(cg, "day") && busyIn(cg, "night")
                            ? t("caregiverView.unavailableBoth")
                            : busyIn(cg, "day")
                              ? t("caregiverView.unavailableDay")
                              : t("caregiverView.unavailableNight")}
                        </Text>
                      </View>
                    )}
                  </View>

                  {true && (
                    <>
                      {/* Day Shift */}
                      <View className="border-divider border-t">
                        <Pressable
                          onPress={async () => {
                            if (isDisabled) return;
                            if (isDayExtraScheduled && !isDayScheduled) {
                              showAlert({
                                title: t("dayDetails.extra"),
                                message: t("dayDetails.legacyExtraMessage"),
                                icon: "information-circle",
                                iconColor: colors.info,
                                buttons: [{ text: t("common.ok"), style: "default" }],
                              });
                              return;
                            }
                            try {
                              await toggleShiftAssignment(cg.id, date, "day");
                            } catch (error) {
                              console.error("Error toggling day assignment:", error);
                              showToggleError(error);
                            }
                          }}
                          disabled={isDisabled}
                          className={`px-4 py-3 ${
                            isDisabled
                              ? "bg-surface-raised"
                              : isDayScheduled
                                ? "bg-primary"
                                : isDayExtraScheduled
                                  ? "bg-primary-soft"
                                  : "bg-surface"
                          }`}
                          style={({ pressed }) => ({
                            opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                          })}>
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-sm">🌅</Text>
                              <Text
                                className={`font-subtitle text-sm ${
                                  isDisabled
                                    ? "text-subtle"
                                    : isDayScheduled
                                      ? "text-on-primary"
                                      : isDayExtraScheduled
                                        ? "text-accent"
                                        : "text-muted"
                                }`}>
                                {t("dayDetails.dayShift")}
                              </Text>
                              {cg.dayAmount && (
                                <Text
                                  className={`text-xs ${isDayScheduled ? "text-on-primary/80" : "text-muted"}`}>
                                  {cg.locked ? "—" : formatMoney(cg.dayAmount)}
                                </Text>
                              )}
                            </View>
                            <View className="flex-row items-center gap-2">
                              {isDayScheduled &&
                                ((cg.additionalAmount ?? 0) > 0 || isDayAdditionalScheduled) && (
                                  <Pressable
                                    onPressIn={(event) => event.stopPropagation()}
                                    onPress={async (event) => {
                                      event.stopPropagation();
                                      if (isDisabled) return;
                                      try {
                                        await toggleShiftAdditional(cg.id, date, "day");
                                      } catch (error) {
                                        console.error("Error toggling day additional:", error);
                                        showToggleError(error);
                                      }
                                    }}
                                    disabled={
                                      isDisabled ||
                                      (isDayAdditionalScheduled && isDayAdditionalPaid)
                                    }
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: isDayAdditionalScheduled,
                                      disabled:
                                        isDisabled ||
                                        (isDayAdditionalScheduled && isDayAdditionalPaid),
                                    }}
                                    accessibilityLabel={t("dayDetails.additional")}
                                    className={`rounded px-2 py-1 ${isDayAdditionalScheduled ? "bg-primary-soft" : "bg-surface-raised"}`}>
                                    <Text
                                      className={`text-[10px] ${isDayAdditionalScheduled ? "text-accent" : "text-muted"}`}>
                                      {t("dayDetails.additional")}
                                      {isDayAdditionalPaid
                                        ? ` · ${t("common.paid")}`
                                        : cg.locked
                                          ? " —"
                                          : (cg.additionalAmount ?? 0) > 0
                                            ? ` ${formatMoney(cg.additionalAmount ?? 0)}`
                                            : ""}
                                    </Text>
                                  </Pressable>
                                )}
                              {isDayScheduled &&
                                !isDayAdditionalScheduled &&
                                (cg.additionalAmount ?? 0) <= 0 && (
                                  <Text className="text-subtle text-[10px]">
                                    {t("dayDetails.additionalUnavailable")}
                                  </Text>
                                )}
                              {isDayExtraScheduled && (
                                <Pressable
                                  onPressIn={(event) => event.stopPropagation()}
                                  onPress={async (event) => {
                                    event.stopPropagation();
                                    try {
                                      await toggleExtraShiftAssignment(cg.id, date, "day");
                                    } catch (error) {
                                      console.error("Error cancelling legacy day extra:", error);
                                      showToggleError(error);
                                    }
                                  }}
                                  disabled={isDisabled || isDayExtraPaid}
                                  accessibilityLabel={`${t("dayDetails.extra")}, ${t("common.cancel")}`}
                                  className="bg-warning-soft rounded px-2 py-1">
                                  <Text className="text-warning text-[10px]">
                                    {t("dayDetails.extra")}
                                  </Text>
                                </Pressable>
                              )}
                              {isDayPaid && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                              {isDayAdditionalScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayAdditionalPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                              {isDayExtraScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayExtraPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                            </View>
                          </View>
                          {isDayAdditionalScheduled && !isDayAdditionalPaid && !cg.locked && (
                            <Text className="text-on-primary/80 mt-1 text-right text-xs">
                              {t("dayDetails.additionalTotal", {
                                regular: formatMoney(cg.dayAmount ?? cg.amount),
                                additional: formatMoney(cg.additionalAmount ?? 0),
                                total: formatMoney(
                                  (cg.dayAmount ?? cg.amount) + (cg.additionalAmount ?? 0),
                                ),
                              })}
                            </Text>
                          )}
                        </Pressable>
                      </View>

                      {/* Night Shift */}
                      <View className="border-divider border-t">
                        <Pressable
                          onPress={async () => {
                            if (isDisabled) return;
                            if (isNightExtraScheduled && !isNightScheduled) {
                              showAlert({
                                title: t("dayDetails.extra"),
                                message: t("dayDetails.legacyExtraMessage"),
                                icon: "information-circle",
                                iconColor: colors.info,
                                buttons: [{ text: t("common.ok"), style: "default" }],
                              });
                              return;
                            }
                            try {
                              await toggleShiftAssignment(cg.id, date, "night");
                            } catch (error) {
                              console.error("Error toggling night assignment:", error);
                              showToggleError(error);
                            }
                          }}
                          disabled={isDisabled}
                          className={`px-4 py-3 ${
                            isDisabled
                              ? "bg-surface-raised"
                              : isNightScheduled
                                ? "bg-primary"
                                : isNightExtraScheduled
                                  ? "bg-primary-soft"
                                  : "bg-surface"
                          }`}
                          style={({ pressed }) => ({
                            opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                          })}>
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-sm">🌙</Text>
                              <Text
                                className={`font-subtitle text-sm ${
                                  isDisabled
                                    ? "text-subtle"
                                    : isNightScheduled
                                      ? "text-on-primary"
                                      : isNightExtraScheduled
                                        ? "text-accent"
                                        : "text-muted"
                                }`}>
                                {t("dayDetails.nightShift")}
                              </Text>
                              {cg.nightAmount && (
                                <Text
                                  className={`text-xs ${isNightScheduled ? "text-on-primary/80" : "text-muted"}`}>
                                  {cg.locked ? "—" : formatMoney(cg.nightAmount)}
                                </Text>
                              )}
                            </View>
                            <View className="flex-row items-center gap-2">
                              {isNightScheduled &&
                                ((cg.additionalAmount ?? 0) > 0 || isNightAdditionalScheduled) && (
                                  <Pressable
                                    onPressIn={(event) => event.stopPropagation()}
                                    onPress={async (event) => {
                                      event.stopPropagation();
                                      if (isDisabled) return;
                                      try {
                                        await toggleShiftAdditional(cg.id, date, "night");
                                      } catch (error) {
                                        console.error("Error toggling night additional:", error);
                                        showToggleError(error);
                                      }
                                    }}
                                    disabled={
                                      isDisabled ||
                                      (isNightAdditionalScheduled && isNightAdditionalPaid)
                                    }
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: isNightAdditionalScheduled,
                                      disabled:
                                        isDisabled ||
                                        (isNightAdditionalScheduled && isNightAdditionalPaid),
                                    }}
                                    accessibilityLabel={t("dayDetails.additional")}
                                    className={`rounded px-2 py-1 ${isNightAdditionalScheduled ? "bg-primary-soft" : "bg-surface-raised"}`}>
                                    <Text
                                      className={`text-[10px] ${isNightAdditionalScheduled ? "text-accent" : "text-muted"}`}>
                                      {t("dayDetails.additional")}
                                      {isNightAdditionalPaid
                                        ? ` · ${t("common.paid")}`
                                        : cg.locked
                                          ? " —"
                                          : (cg.additionalAmount ?? 0) > 0
                                            ? ` ${formatMoney(cg.additionalAmount ?? 0)}`
                                            : ""}
                                    </Text>
                                  </Pressable>
                                )}
                              {isNightScheduled &&
                                !isNightAdditionalScheduled &&
                                (cg.additionalAmount ?? 0) <= 0 && (
                                  <Text className="text-subtle text-[10px]">
                                    {t("dayDetails.additionalUnavailable")}
                                  </Text>
                                )}
                              {isNightExtraScheduled && (
                                <Pressable
                                  onPressIn={(event) => event.stopPropagation()}
                                  onPress={async (event) => {
                                    event.stopPropagation();
                                    try {
                                      await toggleExtraShiftAssignment(cg.id, date, "night");
                                    } catch (error) {
                                      console.error("Error cancelling legacy night extra:", error);
                                      showToggleError(error);
                                    }
                                  }}
                                  disabled={isDisabled || isNightExtraPaid}
                                  accessibilityLabel={`${t("dayDetails.extra")}, ${t("common.cancel")}`}
                                  className="bg-warning-soft rounded px-2 py-1">
                                  <Text className="text-warning text-[10px]">
                                    {t("dayDetails.extra")}
                                  </Text>
                                </Pressable>
                              )}
                              {isNightPaid && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                              {isNightAdditionalScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightAdditionalPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                              {isNightExtraScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightExtraPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                            </View>
                          </View>
                          {isNightAdditionalScheduled && !isNightAdditionalPaid && !cg.locked && (
                            <Text className="text-on-primary/80 mt-1 text-right text-xs">
                              {t("dayDetails.additionalTotal", {
                                regular: formatMoney(cg.nightAmount ?? cg.amount),
                                additional: formatMoney(cg.additionalAmount ?? 0),
                                total: formatMoney(
                                  (cg.nightAmount ?? cg.amount) + (cg.additionalAmount ?? 0),
                                ),
                              })}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })}

            <Pressable
              onPress={() => navigation.goBack()}
              className="bg-surface-raised mt-4 rounded-xl px-4 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Text className="font-subtitle text-content text-center">{t("dayDetails.back")}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
