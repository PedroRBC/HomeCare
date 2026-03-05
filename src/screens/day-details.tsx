import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
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

type RouteParams = { date: string };

export const DayDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { date: dateStr } = route.params as RouteParams;
  const date = useMemo(() => new Date(dateStr), [dateStr]);

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
      className="flex-1 bg-zinc-900 px-6"
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
                  className="h-10 w-10 items-center justify-center rounded-full bg-zinc-700"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}>
                  <Ionicons name="chevron-back" size={20} color="#a1a1aa" />
                </Pressable>

                <View className="flex-1 items-center">
                  <Text className="font-heading text-2xl text-zinc-50">
                    {date.toLocaleDateString("pt-BR")}
                  </Text>
                  <Text className="text-sm text-zinc-400">Defina quem trabalha nesse dia</Text>
                </View>

                <Pressable
                  onPress={goToNextDay}
                  className="h-10 w-10 items-center justify-center rounded-full bg-zinc-700"
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}>
                  <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
                </Pressable>
              </View>
            </View>

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
                <View key={cg.id} className="overflow-hidden rounded-xl border border-zinc-700">
                  {/* Caregiver Header */}
                  <View className={`px-4 py-3 ${isDisabled ? "bg-zinc-700" : "bg-zinc-800"}`}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text
                          className={`font-subtitle text-base ${isDisabled ? "text-zinc-400" : "text-zinc-200"}`}>
                          {cg.name}
                        </Text>
                        {isDisabled && (
                          <View className="rounded bg-zinc-600/20 px-2 py-1">
                            <Text className="text-xs text-zinc-500">Desabilitada</Text>
                          </View>
                        )}
                      </View>
                      <Text className={`text-xs ${isDisabled ? "text-zinc-500" : "text-zinc-400"}`}>
                        {cg.frequency}
                      </Text>
                    </View>
                  </View>

                  {true && (
                    <>
                      {/* Day Shift */}
                      <View className="border-t border-zinc-700">
                        <Pressable
                          onPress={async () => {
                            if (isDisabled) return;
                            try {
                              await toggleShiftAssignment(cg.id, date, "day");
                            } catch (error) {
                              console.error("Error toggling day assignment:", error);
                              showAlert({
                                title: "Erro",
                                message: "Não foi possível alterar o turno. Tente novamente.",
                                icon: "alert-circle",
                                iconColor: "#ef4444",
                                buttons: [{ text: "OK", style: "default" }],
                              });
                            }
                          }}
                          disabled={isDisabled}
                          className={`px-4 py-3 ${
                            isDisabled
                              ? "bg-zinc-700"
                              : isDayScheduled
                                ? "bg-emerald-600"
                                : isDayExtraScheduled
                                  ? "bg-sky-700"
                                  : "bg-zinc-800"
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
                                    ? "text-zinc-500"
                                    : isDayScheduled || isDayExtraScheduled
                                      ? "text-white"
                                      : "text-zinc-300"
                                }`}>
                                Turno Dia
                              </Text>
                              {cg.dayAmount && (
                                <Text
                                  className={`text-xs ${isDayScheduled || isDayExtraScheduled ? "text-white/80" : "text-zinc-400"}`}>
                                  R$ {cg.dayAmount.toFixed(2).replace(".", ",")}
                                </Text>
                              )}
                            </View>
                            <View className="flex-row items-center gap-2">
                              <Pressable
                                onPressIn={(event) => event.stopPropagation()}
                                onPress={async () => {
                                  if (isDisabled) return;
                                  try {
                                    await toggleExtraShiftAssignment(cg.id, date, "day");
                                  } catch (error) {
                                    console.error("Error toggling day extra assignment:", error);
                                  }
                                }}
                                disabled={isDisabled}
                                className={`rounded px-2 py-1 ${isDayExtraScheduled ? "bg-sky-500/30" : "bg-zinc-700"}`}>
                                <Text className={`text-[10px] ${isDayExtraScheduled ? "text-sky-200" : "text-zinc-300"}`}>
                                  Extra
                                </Text>
                              </Pressable>
                              {isDayScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayPaid ? "bg-emerald-300" : "bg-amber-400"}`}
                                />
                              )}
                              {isDayExtraScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isDayExtraPaid ? "bg-sky-200" : "bg-amber-400"}`}
                                />
                              )}
                            </View>
                          </View>
                        </Pressable>
                      </View>

                      {/* Night Shift - Only for Daily */}
                      <View className="border-t border-zinc-700">
                        <Pressable
                          onPress={async () => {
                            if (isDisabled) return;
                            try {
                              await toggleShiftAssignment(cg.id, date, "night");
                            } catch (error) {
                              console.error("Error toggling night assignment:", error);
                              showAlert({
                                title: "Erro",
                                message: "Não foi possível alterar o turno. Tente novamente.",
                                icon: "alert-circle",
                                iconColor: "#ef4444",
                                buttons: [{ text: "OK", style: "default" }],
                              });
                            }
                          }}
                          disabled={isDisabled}
                          className={`px-4 py-3 ${
                            isDisabled
                              ? "bg-zinc-700"
                              : isNightScheduled
                                ? "bg-emerald-600"
                                : isNightExtraScheduled
                                  ? "bg-sky-700"
                                  : "bg-zinc-800"
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
                                    ? "text-zinc-500"
                                    : isNightScheduled || isNightExtraScheduled
                                      ? "text-white"
                                      : "text-zinc-300"
                                }`}>
                                Turno Noite
                              </Text>
                              {cg.nightAmount && (
                                <Text
                                  className={`text-xs ${isNightScheduled || isNightExtraScheduled ? "text-white/80" : "text-zinc-400"}`}>
                                  R$ {cg.nightAmount.toFixed(2).replace(".", ",")}
                                </Text>
                              )}
                            </View>
                            <View className="flex-row items-center gap-2">
                              <Pressable
                                onPressIn={(event) => event.stopPropagation()}
                                onPress={async () => {
                                  if (isDisabled) return;
                                  try {
                                    await toggleExtraShiftAssignment(cg.id, date, "night");
                                  } catch (error) {
                                    console.error("Error toggling night extra assignment:", error);
                                  }
                                }}
                                disabled={isDisabled}
                                className={`rounded px-2 py-1 ${isNightExtraScheduled ? "bg-sky-500/30" : "bg-zinc-700"}`}>
                                <Text className={`text-[10px] ${isNightExtraScheduled ? "text-sky-200" : "text-zinc-300"}`}>
                                  Extra
                                </Text>
                              </Pressable>
                              {isNightScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightPaid ? "bg-emerald-300" : "bg-amber-400"}`}
                                />
                              )}
                              {isNightExtraScheduled && (
                                <View
                                  className={`h-2 w-2 rounded-full ${isNightExtraPaid ? "bg-sky-200" : "bg-amber-400"}`}
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
              className="mt-4 rounded-xl bg-zinc-700 px-4 py-4"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Text className="font-subtitle text-center text-white">Voltar</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};
