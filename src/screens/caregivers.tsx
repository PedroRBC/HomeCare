import { useAppTheme } from "@/theme";
import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatMoney, frequencyLabel } from "@/i18n/format";
import { CaregiverLinkStatusBadge } from "@/components/CaregiverLinkStatusBadge";
import { useHouseCaregiverLinks } from "@/hooks/useCaregiverLinks";

export const CaregiversScreen = () => {
  const { colors } = useAppTheme();
  // Track screen view
  useScreenTracking("Caregivers", "CaregiversScreen");

  const { t, i18n } = useTranslation();
  const { caregivers } = useSchedule();
  const linksByCaregiver = useHouseCaregiverLinks();
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
        caregiver.disabled ? "border-divider bg-surface-raised" : "border-divider bg-surface"
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
                caregiver.disabled ? "text-muted" : "text-content"
              }`}>
              {caregiver.name}
            </Text>
            <View
              className={`rounded px-2 py-1 ${
                caregiver.disabled ? "bg-disabled/20" : "bg-primary-soft"
              }`}>
              <Text className={`text-xs ${caregiver.disabled ? "text-subtle" : "text-accent"}`}>
                {frequencyLabel(caregiver.frequency)}
              </Text>
            </View>
            {caregiver.disabled && (
              <View className="bg-danger-soft rounded px-2 py-1">
                <Text className="text-danger text-xs">{t("caregivers.disabled")}</Text>
              </View>
            )}
          </View>
          {caregiver.email ? (
            <View className="mb-1 flex-row items-center gap-1">
              <Ionicons name="person-circle-outline" size={14} color={colors.accent} />
              <Text className="text-accent text-xs">{caregiver.email}</Text>
              <CaregiverLinkStatusBadge link={linksByCaregiver[caregiver.id]} />
            </View>
          ) : null}
          <View className="flex-row gap-4">
            <View>
              <Text className="text-muted text-xs">{t("caregivers.day")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-subtle" : "text-content"}`}>
                {caregiver.locked ? "—" : formatMoney(caregiver.dayAmount || 0)}
              </Text>
            </View>
            <View>
              <Text className="text-muted text-xs">{t("caregivers.night")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-subtle" : "text-content"}`}>
                {caregiver.locked ? "—" : formatMoney(caregiver.nightAmount || 0)}
              </Text>
            </View>
            <View>
              <Text className="text-muted text-xs">{t("caregivers.total")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-subtle" : "text-content"}`}>
                {caregiver.locked ? "—" : formatMoney(caregiver.amount)}
              </Text>
            </View>
          </View>
          {(caregiver.additionalAmount ?? 0) > 0 && (
            <View className="mt-2">
              <Text className="text-muted text-xs">{t("caregivers.additionalAmount")}</Text>
              <Text className={`text-sm ${caregiver.disabled ? "text-subtle" : "text-content"}`}>
                {caregiver.locked ? "—" : formatMoney(caregiver.additionalAmount!)}
              </Text>
            </View>
          )}
          {caregiver.locked && (
            <Text className="text-warning mt-2 text-xs">{t("errors.ratesUnavailable")}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </Pressable>
  );

  return (
    <View className="bg-app flex-1">
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
              <Text className="font-heading text-content text-2xl">{t("caregivers.title")}</Text>
              <Text className="text-muted text-sm">
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
                  showDisabled ? "border-primary bg-primary-soft" : "border-divider bg-surface"
                }`}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                })}>
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={showDisabled ? "eye-off" : "eye"}
                    size={16}
                    color={showDisabled ? colors.accent : colors.textSecondary}
                  />
                  <Text className={`text-sm ${showDisabled ? "text-accent" : "text-muted"}`}>
                    {showDisabled ? t("caregivers.hideDisabled") : t("caregivers.showDisabled")}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {caregivers.length === 0 ? (
          <View className="items-center py-12">
            <Ionicons name="people-outline" size={64} color={colors.textMuted} />
            <Text className="text-muted mt-4 text-center text-lg">{t("caregivers.none")}</Text>
            <Text className="text-subtle mt-2 text-center">{t("caregivers.noneHint")}</Text>
            <Pressable
              onPress={() => navigation.navigate("Create" as never)}
              className="bg-primary mt-6 rounded-xl px-6 py-3"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Text className="font-subtitle text-on-primary">{t("caregivers.add")}</Text>
            </Pressable>
          </View>
        ) : filteredCaregivers.length === 0 ? (
          <View className="items-center py-12">
            <Ionicons name="eye-off-outline" size={64} color={colors.textMuted} />
            <Text className="text-muted mt-4 text-center text-lg">
              {t("caregivers.noneActive")}
            </Text>
            <Text className="text-subtle mt-2 text-center">{t("caregivers.allDisabled")}</Text>
            <Pressable
              onPress={() => setShowDisabled(true)}
              className="bg-surface-raised mt-6 rounded-xl px-6 py-3"
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
              })}>
              <Text className="font-subtitle text-content">{t("caregivers.showDisabled")}</Text>
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
