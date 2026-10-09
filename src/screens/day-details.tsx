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
import { useCaregiverAvailability } from "@/hooks/useCaregiverLinks";

type RouteParams = { date: string };

export const DayDetailsScreen = () => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { date: dateStr } = route.params as RouteParams;
  const date = useMemo(() => parseCalendarDate(dateStr), [dateStr]);

  // Track screen view
  useScreenTracking("DayDetails", "DayDetailsScreen");

  const {
    caregivers,
    getScheduledCaregivers,
    getExtraScheduledCaregivers,
    toggleShiftAssignment,
    toggleExtraShiftAssignment,
    isPaidForCaregiverShift,
  } = useSchedule();
  const { showAlert } = useAlert();
  const { isBusy: isBusyElsewhere, isUnknown: availabilityUnknown } = useCaregiverAvailability();
  const busyIn = (cg: Caregiver, shift: ShiftType) =>
    isBusyElsewhere(cg.email, shiftKey(dateKey(date), shift));

  // Assigning a caregiver who already works this shift in another house, or whose
  // availability can't be checked, needs confirmation
  const confirmIfBusy = (cg: Caregiver, shift: ShiftType, alreadyInShift: boolean) =>
    new Promise<boolean>((resolve) => {
      const unknown = availabilityUnknown && !!cg.email;
      if (alreadyInShift || (!unknown && !busyIn(cg, shift))) return resolve(true);
      const shiftLabel = t(
        shift === "day" ? "caregiverView.shiftDayWord" : "caregiverView.shiftNightWord",
      );
      showAlert({
        title: unknown ? t("caregiverView.unknownTitle") : t("caregiverView.unavailableTitle"),
        message: unknown
          ? t("caregiverView.unknownMessage", { name: cg.name, shift: shiftLabel })
          : t("caregiverView.busyMessage", { name: cg.name, shift: shiftLabel }),
        icon: "warning",
        iconColor: colors.warning,
        buttons: [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          {
            text: t("caregiverView.scheduleAnyway"),
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
        // Closing the alert any other way cancels the assignment
        onDismiss: () => resolve(false),
      });
    });
  // Changes only show once saved, so a failed one must be reported
  const showToggleError = () =>
    showAlert({
      title: t("common.error"),
      message: t("dayDetails.toggleError"),
      icon: "alert-circle",
      iconColor: colors.danger,
      buttons: [{ text: t("common.ok"), style: "default" }],
    });
  const dayCaregivers = getScheduledCaregivers(date, "day");
  const nightCaregivers = getScheduledCaregivers(date, "night");
  const dayExtraCaregivers = getExtraScheduledCaregivers(date, "day");
  const nightExtraCaregivers = getExtraScheduledCaregivers(date, "night");
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
              <View
                testID="availability-unknown"
                className="border-warning bg-warning-soft flex-row items-center gap-2 rounded-xl border p-3">
                <Ionicons name="cloud-offline" size={16} color={colors.warning} />
                <Text className="text-warning flex-1 text-xs">
                  {t("caregiverView.availabilityUnknown")}
                </Text>
              </View>
            )}

            {caregivers.map((cg) => {
              const isDayScheduled = dayCaregivers.some((c) => c.id === cg.id);
              const isNightScheduled = nightCaregivers.some((c) => c.id === cg.id);
              const isDayExtraScheduled = dayExtraCaregivers.some((c) => c.id === cg.id);
              const isNightExtraScheduled = nightExtraCaregivers.some((c) => c.id === cg.id);
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
                            try {
                              if (
                                !(await confirmIfBusy(
                                  cg,
                                  "day",
                                  isDayScheduled || isDayExtraScheduled,
                                ))
                              )
                                return;
                              await toggleShiftAssignment(cg.id, date, "day");
                            } catch (error) {
                              console.error("Error toggling day assignment:", error);
                              showAlert({
                                title: t("common.error"),
                                message: t("dayDetails.toggleError"),
                                icon: "alert-circle",
                                iconColor: colors.danger,
                                buttons: [{ text: t("common.ok"), style: "default" }],
                              });
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
                              <Pressable
                                onPressIn={(event) => event.stopPropagation()}
                                onPress={async () => {
                                  if (isDisabled) return;
                                  try {
                                    if (
                                      !(await confirmIfBusy(
                                        cg,
                                        "day",
                                        isDayScheduled || isDayExtraScheduled,
                                      ))
                                    )
                                      return;
                                    await toggleExtraShiftAssignment(cg.id, date, "day");
                                  } catch (error) {
                                    console.error("Error toggling day extra assignment:", error);
                                    showToggleError();
                                  }
                                }}
                                disabled={isDisabled}
                                className={`rounded px-2 py-1 ${isDayExtraScheduled ? "bg-primary-soft" : "bg-surface-raised"}`}>
                                <Text
                                  className={`text-[10px] ${isDayExtraScheduled ? "text-accent" : "text-muted"}`}>
                                  {t("dayDetails.extra")}
                                </Text>
                              </Pressable>
                              {isDayScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayPaid ? "bg-emerald-300" : "bg-amber-300"}`}
                                />
                              )}
                              {isDayExtraScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayExtraPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                            </View>
                          </View>
                        </Pressable>
                      </View>

                      {/* Night Shift - Only for Daily */}
                      <View className="border-divider border-t">
                        <Pressable
                          onPress={async () => {
                            if (isDisabled) return;
                            try {
                              if (
                                !(await confirmIfBusy(
                                  cg,
                                  "night",
                                  isNightScheduled || isNightExtraScheduled,
                                ))
                              )
                                return;
                              await toggleShiftAssignment(cg.id, date, "night");
                            } catch (error) {
                              console.error("Error toggling night assignment:", error);
                              showAlert({
                                title: t("common.error"),
                                message: t("dayDetails.toggleError"),
                                icon: "alert-circle",
                                iconColor: colors.danger,
                                buttons: [{ text: t("common.ok"), style: "default" }],
                              });
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
                              <Pressable
                                onPressIn={(event) => event.stopPropagation()}
                                onPress={async () => {
                                  if (isDisabled) return;
                                  try {
                                    if (
                                      !(await confirmIfBusy(
                                        cg,
                                        "night",
                                        isNightScheduled || isNightExtraScheduled,
                                      ))
                                    )
                                      return;
                                    await toggleExtraShiftAssignment(cg.id, date, "night");
                                  } catch (error) {
                                    console.error("Error toggling night extra assignment:", error);
                                    showToggleError();
                                  }
                                }}
                                disabled={isDisabled}
                                className={`rounded px-2 py-1 ${isNightExtraScheduled ? "bg-primary-soft" : "bg-surface-raised"}`}>
                                <Text
                                  className={`text-[10px] ${isNightExtraScheduled ? "text-accent" : "text-muted"}`}>
                                  {t("dayDetails.extra")}
                                </Text>
                              </Pressable>
                              {isNightScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightPaid ? "bg-emerald-300" : "bg-amber-300"}`}
                                />
                              )}
                              {isNightExtraScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightExtraPaid ? "bg-success" : "bg-warning"}`}
                                />
                              )}
                            </View>
                          </View>
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
