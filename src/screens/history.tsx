import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import type { PaymentHistory } from "@/context/ScheduleContext";
import { useAlert } from "@/context/AlertContext";
import { useHouse } from "@/context/HouseContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "@/hooks/useFirebase";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import { exportPaymentHistoryExcel, exportPaymentHistoryPDF } from "@/services/exportService";
import { useTranslation } from "react-i18next";
import {
  formatDate,
  formatMonthYear,
  formatMoney,
  formatTime,
  frequencyLabel,
  localizedDescription,
} from "@/i18n/format";

type TimeRangeFilter =
  "all" | "week" | "30days" | "90days" | "thisMonth" | "lastMonth" | `month:${string}`;

function monthKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const formatted = formatMonthYear(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const HistoryRow = ({
  item,
  onPress,
}: {
  item: PaymentHistory;
  onPress: (item: PaymentHistory) => void;
}) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <Card variant="elevated">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20">
              <Ionicons name="person-outline" size={20} color="#10B981" />
            </View>
            <View>
              <Text className="font-heading text-zinc-100">{item.caregiverName}</Text>
              <Text className="text-xs text-zinc-400">{frequencyLabel(item.frequency)}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="font-subtitle text-sm text-emerald-400">{t("common.paid")}</Text>
            <Text className="font-heading text-lg text-emerald-400">
              {item.locked ? "—" : formatMoney(item.amount)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="mr-2 flex-1 text-xs text-zinc-400">
            {localizedDescription(item.description)}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-zinc-500">
              {t("history.dateAt", {
                date: formatDate(new Date(item.paidAt)),
                time: formatTime(new Date(item.paidAt), { hour: "2-digit", minute: "2-digit" }),
              })}
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
          </View>
        </View>
        {item.locked && (
          <Text className="mb-2 text-xs text-amber-400">{t("errors.ratesUnavailable")}</Text>
        )}
        {item.managerName && (
          <View className="mt-2 flex-row items-center gap-1">
            <Ionicons name="person-outline" size={12} color="#9CA3AF" />
            <Text className="text-xs text-zinc-500">
              {t("history.paidBy", { name: item.managerName })}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
};

export const HistoryScreen = () => {
  // Track screen view
  useScreenTracking("History", "HistoryScreen");

  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { paymentHistory, caregivers } = useSchedule();
  const { showAlert } = useAlert();
  const { currentHouse } = useHouse();
  const [selectedCaregiver, setSelectedCaregiver] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeFilter>("all");
  const [isExporting, setIsExporting] = useState(false);

  const monthFilters = useMemo(() => {
    const uniqueMonthKeys = new Set<string>();

    for (const payment of paymentHistory) {
      uniqueMonthKeys.add(monthKeyFromDate(new Date(payment.paidAt)));
    }

    return Array.from(uniqueMonthKeys)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 12)
      .map((monthKey) => ({
        value: `month:${monthKey}` as TimeRangeFilter,
        label: monthLabel(monthKey),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels depend on the active language
  }, [paymentHistory, i18n.language]);

  const filteredPayments = useMemo(() => {
    let filtered = paymentHistory;

    // Filter by caregiver
    if (selectedCaregiver !== "all") {
      filtered = filtered.filter((item) => item.caregiverId === selectedCaregiver);
    }

    // Filter by time range
    if (selectedTimeRange !== "all") {
      const now = new Date();

      if (selectedTimeRange.startsWith("month:")) {
        const monthKey = selectedTimeRange.replace("month:", "");
        filtered = filtered.filter((item) => monthKeyFromDate(new Date(item.paidAt)) === monthKey);
      } else {
        const cutoffDate = new Date();

        switch (selectedTimeRange) {
          case "week":
            cutoffDate.setDate(now.getDate() - 7);
            filtered = filtered.filter((item) => new Date(item.paidAt) >= cutoffDate);
            break;
          case "30days":
            cutoffDate.setDate(now.getDate() - 30);
            filtered = filtered.filter((item) => new Date(item.paidAt) >= cutoffDate);
            break;
          case "90days":
            cutoffDate.setDate(now.getDate() - 90);
            filtered = filtered.filter((item) => new Date(item.paidAt) >= cutoffDate);
            break;
          case "thisMonth":
            filtered = filtered.filter((item) => {
              const paidDate = new Date(item.paidAt);
              return (
                paidDate.getFullYear() === now.getFullYear() &&
                paidDate.getMonth() === now.getMonth()
              );
            });
            break;
          case "lastMonth": {
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthDate = new Date(currentMonthStart);
            lastMonthDate.setDate(0);
            filtered = filtered.filter((item) => {
              const paidDate = new Date(item.paidAt);
              return (
                paidDate.getFullYear() === lastMonthDate.getFullYear() &&
                paidDate.getMonth() === lastMonthDate.getMonth()
              );
            });
            break;
          }
        }
      }
    }

    return filtered;
  }, [paymentHistory, selectedCaregiver, selectedTimeRange]);

  const selectedCaregiverLabel = useMemo(() => {
    if (selectedCaregiver === "all") return t("history.allCaregivers");
    return (
      caregivers.find((item) => item.id === selectedCaregiver)?.name ||
      t("history.selectedCaregiver")
    );
  }, [caregivers, selectedCaregiver, t]);

  const selectedPeriodLabel = useMemo(() => {
    if (selectedTimeRange === "all") return t("history.allTime");
    if (selectedTimeRange === "week") return t("history.lastWeek");
    if (selectedTimeRange === "30days") return t("history.last30");
    if (selectedTimeRange === "90days") return t("history.last90");
    if (selectedTimeRange === "thisMonth") return t("history.thisMonth");
    if (selectedTimeRange === "lastMonth") return t("history.lastMonth");
    if (selectedTimeRange.startsWith("month:")) {
      return monthLabel(selectedTimeRange.replace("month:", ""));
    }
    return t("history.selectedPeriod");
  }, [selectedTimeRange, t]);

  const totalAmount = useMemo(() => {
    return filteredPayments.reduce((sum, item) => sum + (item.locked ? 0 : item.amount), 0);
  }, [filteredPayments]);

  const handlePaymentPress = (payment: PaymentHistory) => {
    (navigation as any).navigate("PaymentDetails", { payment });
  };

  const handleExportExcel = async () => {
    if (filteredPayments.length === 0) return;
    setIsExporting(true);
    try {
      await exportPaymentHistoryExcel(filteredPayments, {
        houseName: currentHouse?.name,
        periodLabel: selectedPeriodLabel,
        caregiverLabel: selectedCaregiverLabel,
      });
    } catch {
      showAlert({
        title: t("common.error"),
        message: t("history.exportExcelError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (filteredPayments.length === 0) return;
    setIsExporting(true);
    try {
      await exportPaymentHistoryPDF(filteredPayments, {
        houseName: currentHouse?.name,
        periodLabel: selectedPeriodLabel,
        caregiverLabel: selectedCaregiverLabel,
      });
    } catch {
      showAlert({
        title: t("common.error"),
        message: t("history.exportPdfError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setIsExporting(false);
    }
  };

  const { top: topInset } = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingTop: topInset + 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-heading mb-2 text-2xl text-zinc-50">{t("history.title")}</Text>
              <Text className="text-zinc-400">{t("history.subtitle")}</Text>
            </View>
            {filteredPayments.length > 0 && (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleExportExcel}
                  disabled={isExporting}
                  className="h-10 w-10 items-center justify-center rounded-full bg-zinc-800"
                  style={({ pressed }) => ({ opacity: pressed || isExporting ? 0.5 : 1 })}
                  accessibilityLabel={t("history.exportExcel")}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isExporting }}>
                  <Ionicons
                    name="grid-outline"
                    size={18}
                    color="#a1a1aa"
                    accessibilityLabelHidden
                  />
                </Pressable>
                <Pressable
                  onPress={handleExportPDF}
                  disabled={isExporting}
                  className="h-10 w-10 items-center justify-center rounded-full bg-zinc-800"
                  style={({ pressed }) => ({ opacity: pressed || isExporting ? 0.5 : 1 })}
                  accessibilityLabel={t("history.exportPdf")}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isExporting }}>
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color="#a1a1aa"
                    accessibilityLabelHidden
                  />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View className="gap-6">
          {/* Caregiver Filter */}
          <View className="gap-2">
            <Text className="font-subtitle text-sm text-zinc-300">
              {t("history.filterCaregiver")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}>
              <Pressable
                onPress={() => setSelectedCaregiver("all")}
                className={`rounded-full border px-4 py-2 ${selectedCaregiver === "all" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedCaregiver === "all" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.all")}
                </Text>
              </Pressable>
              {caregivers.map((caregiver) => (
                <Pressable
                  key={caregiver.id}
                  onPress={() => setSelectedCaregiver(caregiver.id)}
                  className={`rounded-full border px-4 py-2 ${selectedCaregiver === caregiver.id ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                  <Text
                    className={`text-sm ${selectedCaregiver === caregiver.id ? "text-white" : "text-zinc-300"}`}>
                    {caregiver.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Time Range Filter */}
          <View className="gap-2">
            <Text className="font-subtitle text-sm text-zinc-300">{t("history.filterPeriod")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}>
              <Pressable
                onPress={() => setSelectedTimeRange("all")}
                className={`rounded-full border px-4 py-2 ${selectedTimeRange === "all" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedTimeRange === "all" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.allTime")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTimeRange("week")}
                className={`rounded-full border px-4 py-2 ${selectedTimeRange === "week" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedTimeRange === "week" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.lastWeek")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTimeRange("thisMonth")}
                className={`rounded-full border px-4 py-2 ${selectedTimeRange === "thisMonth" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedTimeRange === "thisMonth" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.thisMonth")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTimeRange("lastMonth")}
                className={`rounded-full border px-4 py-2 ${selectedTimeRange === "lastMonth" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedTimeRange === "lastMonth" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.lastMonth")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTimeRange("30days")}
                className={`rounded-full border px-4 py-2 ${selectedTimeRange === "30days" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedTimeRange === "30days" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.last30")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedTimeRange("90days")}
                className={`rounded-full border px-4 py-2 ${selectedTimeRange === "90days" ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                <Text
                  className={`text-sm ${selectedTimeRange === "90days" ? "text-white" : "text-zinc-300"}`}>
                  {t("history.last90")}
                </Text>
              </Pressable>
              {monthFilters.map((month) => (
                <Pressable
                  key={month.value}
                  onPress={() => setSelectedTimeRange(month.value)}
                  className={`rounded-full border px-4 py-2 ${selectedTimeRange === month.value ? "border-emerald-600 bg-emerald-600" : "border-zinc-700 bg-transparent"}`}>
                  <Text
                    className={`text-sm ${selectedTimeRange === month.value ? "text-white" : "text-zinc-300"}`}>
                    {month.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Total Amount */}
          {filteredPayments.length > 0 && (
            <Card variant="elevated">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20">
                    <Ionicons name="card-outline" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text className="font-subtitle text-sm text-emerald-200">
                      {t("history.totalPaid")}
                    </Text>
                    <Text className="font-heading text-2xl text-emerald-200">
                      {filteredPayments.some((item) => item.locked)
                        ? "—"
                        : formatMoney(totalAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          )}

          {/* Payment List */}
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={t("history.noneFound")}
              description={
                selectedCaregiver === "all" && selectedTimeRange === "all"
                  ? t("history.noneYet")
                  : t("history.noneFiltered")
              }
            />
          ) : (
            <View className="gap-3">
              {filteredPayments.map((item) => (
                <HistoryRow key={item.id} item={item} onPress={handlePaymentPress} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
