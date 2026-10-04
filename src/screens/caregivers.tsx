import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatMoney, frequencyLabel } from "@/i18n/format";

export const CaregiversScreen = () => {
  // Track screen view
  useScreenTracking("Caregivers", "CaregiversScreen");

  const { t, i18n } = useTranslation();
  const { caregivers } = useSchedule();
  const navigation = useNavigation<any>();
  const { top: topInset } = useSafeAreaInsets();

  // Filter state
  const [showDisabled, setShowDisabled] = useState(false);

  // Filter caregivers based on disabled status
  const filteredCaregivers = useMemo(() => {
    if (showDisabled) {
      return caregivers; // Show all caregivers
    }
    return caregivers.filter((caregiver) => !caregiver.disabled); // Show only active caregivers
  }, [caregivers, showDisabled]);

  // Count active and disabled caregivers
  const activeCount = caregivers.filter((c) => !c.disabled).length;
  const disabledCount = caregivers.filter((c) => c.disabled).length;

  const renderCaregiver = ({ item: caregiver }: { item: any }) => (
    <Pressable
      onPress={() => navigation.navigate("EditCaregiver", { caregiverId: caregiver.id })}
      className={`mb-3 rounded-xl border p-4 ${
        caregiver.disabled ? "border-zinc-600 bg-zinc-700" : "border-zinc-700 bg-zinc-800"
      }`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="mb-1 flex-row items-center gap-2">
            <Text
              className={`font-heading text-lg ${
                caregiver.disabled ? "text-zinc-400" : "text-zinc-100"
              }`}>
              {caregiver.name}
            </Text>
            <View
              className={`rounded px-2 py-1 ${
                caregiver.disabled ? "bg-zinc-600/20" : "bg-emerald-600/20"
              }`}>
              <Text
                className={`text-xs ${caregiver.disabled ? "text-zinc-500" : "text-emerald-300"}`}>
                {frequencyLabel(caregiver.frequency)}
              </Text>
            </View>
            {caregiver.disabled && (
              <View className="rounded bg-rose-600/20 px-2 py-1">
                <Text className="text-xs text-rose-400">{t("caregivers.disabled")}</Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-4">
            <View>
              <Text className="text-xs text-zinc-400">{t("caregivers.day")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-zinc-500" : "text-zinc-200"}`}>
                {formatMoney(caregiver.dayAmount || 0)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-zinc-400">{t("caregivers.night")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-zinc-500" : "text-zinc-200"}`}>
                {formatMoney(caregiver.nightAmount || 0)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-zinc-400">{t("caregivers.total")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-zinc-500" : "text-zinc-200"}`}>
                {formatMoney(caregiver.amount)}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-heading text-2xl text-zinc-50">{t("caregivers.title")}</Text>
              <Text className="text-sm text-zinc-400">
                {showDisabled
                  ? t("caregivers.summaryAll", { count: caregivers.length })
                  : t("caregivers.summaryActive", { count: activeCount })}{" "}
                • {t("caregivers.summaryDisabled", { count: disabledCount })}
              </Text>
            </View>
            {disabledCount > 0 && (
              <Pressable
                onPress={() => setShowDisabled(!showDisabled)}
                className={`rounded-lg border px-3 py-2 ${
                  showDisabled
                    ? "border-emerald-600 bg-emerald-600/20"
                    : "border-zinc-600 bg-zinc-800"
                }`}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                })}>
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={showDisabled ? "eye-off" : "eye"}
                    size={16}
                    color={showDisabled ? "#10B981" : "#9CA3AF"}
                  />
                  <Text
                    className={`text-sm ${showDisabled ? "text-emerald-300" : "text-zinc-400"}`}>
                    {showDisabled ? t("caregivers.hideDisabled") : t("caregivers.showDisabled")}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {caregivers.length === 0 ? (
          <View className="items-center py-12">
            <Ionicons name="people-outline" size={64} color="#6B7280" />
            <Text className="mt-4 text-center text-lg text-zinc-400">{t("caregivers.none")}</Text>
            <Text className="mt-2 text-center text-zinc-500">{t("caregivers.noneHint")}</Text>
            <Pressable
              onPress={() => navigation.navigate("Create" as never)}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Text className="font-subtitle text-white">{t("caregivers.add")}</Text>
            </Pressable>
          </View>
        ) : filteredCaregivers.length === 0 ? (
          <View className="items-center py-12">
            <Ionicons name="eye-off-outline" size={64} color="#6B7280" />
            <Text className="mt-4 text-center text-lg text-zinc-400">
              {t("caregivers.noneActive")}
            </Text>
            <Text className="mt-2 text-center text-zinc-500">{t("caregivers.allDisabled")}</Text>
            <Pressable
              onPress={() => setShowDisabled(true)}
              className="mt-6 rounded-xl bg-zinc-700 px-6 py-3"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Text className="font-subtitle text-zinc-200">{t("caregivers.showDisabled")}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredCaregivers}
            renderItem={renderCaregiver}
            keyExtractor={(item) => item.id}
            extraData={i18n.language}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ScrollView>
    </View>
  );
};
