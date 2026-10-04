import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useCaregiver } from "@/context/CaregiverContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { CalendarHeader } from "@/components/CalendarHeader";
import { WeekdayHeader } from "@/components/WeekdayHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { dateKey, monthKey, parseCalendarDate } from "@/utils/date";
import { groupShiftsByDate, type CaregiverShift } from "@/utils/caregiverShifts";
import { useTranslation } from "react-i18next";
import { currentLocale } from "@/i18n/locale";
import { formatMonthYear } from "@/i18n/format";

const UPCOMING_LIMIT = 10;

function formatDay(key: string) {
  const label = parseCalendarDate(key).toLocaleDateString(currentLocale(), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ShiftBadge = ({ shift }: { shift: CaregiverShift }) => {
  const { t } = useTranslation();
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${
        shift.shift === "day" ? "bg-amber-500/20" : "bg-indigo-500/20"
      }`}>
      <Ionicons
        name={shift.shift === "day" ? "sunny" : "moon"}
        size={12}
        color={shift.shift === "day" ? "#fbbf24" : "#a5b4fc"}
      />
      <Text className={`text-xs ${shift.shift === "day" ? "text-amber-300" : "text-indigo-300"}`}>
        {shift.shift === "day" ? t("common.day") : t("common.night")}
        {shift.extra ? t("caregiverView.extraBadge") : ""}
      </Text>
    </View>
  );
};

// One row per day and house, with that house's shifts of the day
const ShiftRow = ({
  date,
  shifts,
  showDate = true,
}: {
  date: string;
  shifts: CaregiverShift[];
  showDate?: boolean;
}) => {
  const byHouse = new Map<string, CaregiverShift[]>();
  shifts.forEach((s) => byHouse.set(s.houseId, [...(byHouse.get(s.houseId) ?? []), s]));

  return (
    <>
      {[...byHouse.values()].map((houseShifts) => (
        <View
          key={`${date}-${houseShifts[0].houseId}`}
          testID="shift-row"
          className="flex-row items-center justify-between border-b border-zinc-700/60 py-3">
          <View className="flex-1 pr-2">
            {showDate && <Text className="font-subtitle text-zinc-100">{formatDay(date)}</Text>}
            <Text className={showDate ? "text-sm text-zinc-400" : "font-subtitle text-zinc-100"}>
              {houseShifts[0].houseName}
            </Text>
          </View>
          <View className="flex-row flex-wrap justify-end gap-2">
            {houseShifts.map((s) => (
              <ShiftBadge key={s.shift} shift={s} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
};

export const MyShiftsScreen = () => {
  const { t } = useTranslation();
  useScreenTracking("MyShifts", "MyShiftsScreen");

  const { top: topInset } = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    links,
    acceptedLinks,
    pendingLinks,
    respondToLink,
    shifts,
    isLoading,
    unavailableHouseIds,
  } = useCaregiver();
  const { showAlert } = useAlert();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const respond = async (linkId: string, accept: boolean) => {
    setRespondingId(linkId);
    try {
      await respondToLink(linkId, accept);
    } catch (error) {
      console.error("Error answering caregiver invitation:", error);
      showAlert({
        title: t("common.error"),
        message: t("caregiverView.respondError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [{ text: t("common.ok"), style: "default" }],
      });
    } finally {
      setRespondingId(null);
    }
  };

  const [houseFilter, setHouseFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Distinct accepted houses, in a stable order
  const houses = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; disabled: boolean }>();
    acceptedLinks.forEach((l) => {
      const prev = byId.get(l.houseId);
      // Linked more than once to a house: active if any of the links is
      byId.set(l.houseId, {
        id: l.houseId,
        name: l.houseName || t("caregiverView.houseFallback"),
        disabled: (prev?.disabled ?? true) && !!l.disabled,
      });
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [acceptedLinks, t]);

  // The filtered house may have unlinked her in the meantime
  const activeFilter = houses.some((h) => h.id === houseFilter) ? houseFilter : null;
  const visibleShifts = useMemo(
    () => (activeFilter ? shifts.filter((s) => s.houseId === activeFilter) : shifts),
    [shifts, activeFilter],
  );
  const shiftsByDate = useMemo(() => groupShiftsByDate(visibleShifts), [visibleShifts]);

  const { daysGrid, monthLabel, monthShifts } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const cells: (Date | null)[] = Array(new Date(year, month, 1).getDay()).fill(null);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7) cells.push(null);

    const prefix = monthKey(year, month);
    return {
      daysGrid: cells,
      monthLabel: formatMonthYear(currentMonth),
      monthShifts: visibleShifts.filter((s) => s.date.startsWith(prefix)),
    };
  }, [currentMonth, visibleShifts]);

  const today = dateKey(new Date());
  const upcomingDates = useMemo(
    () =>
      Object.keys(shiftsByDate)
        .filter((d) => d >= today)
        .slice(0, UPCOMING_LIMIT),
    [shiftsByDate, today],
  );

  const changeMonth = (offset: number) => {
    setSelectedDay(null);
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <ActivityIndicator size="large" color="#10b981" />
        <Text className="mt-4 text-zinc-400">{t("caregiverView.loading")}</Text>
      </View>
    );
  }

  if (links.length === 0) {
    return (
      <View className="flex-1 bg-zinc-900" style={{ paddingTop: topInset }}>
        <EmptyState
          icon="calendar-outline"
          title={t("caregiverView.noHouse")}
          description={
            user?.email
              ? t("caregiverView.noHouseEmail", { email: user.email })
              : t("caregiverView.noHouseNoEmail")
          }
        />
      </View>
    );
  }

  const dayCount = monthShifts.filter((s) => s.shift === "day").length;
  const nightCount = monthShifts.length - dayCount;
  const extraCount = monthShifts.filter((s) => s.extra).length;

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          paddingHorizontal: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <View>
          <Text className="font-heading text-2xl text-zinc-50">{t("caregiverView.title")}</Text>
          <Text className="text-sm text-zinc-400">
            {houses.length === 0
              ? t("caregiverView.acceptToSee")
              : t("caregiverView.realtime", {
                  schedule:
                    houses.length === 1
                      ? t("caregiverView.scheduleOfHouse", { name: houses[0].name })
                      : t("caregiverView.scheduleOfHouses", { count: houses.length }),
                })}
          </Text>
        </View>

        {pendingLinks.map((link) => (
          <View
            key={link.id}
            testID="caregiver-invitation"
            className="gap-3 rounded-xl border border-amber-700 bg-amber-900/20 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-unread" size={20} color="#fbbf24" />
              <Text className="font-subtitle flex-1 text-white">
                {t("caregiverView.inviteFrom", { house: link.houseName })}
              </Text>
            </View>
            <Text className="text-sm text-amber-200">
              {t("caregiverView.registeredAs", { name: link.caregiverName })}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                disabled={respondingId === link.id}
                onPress={() => respond(link.id, false)}
                className="flex-1 items-center rounded-lg border border-zinc-600 py-3"
                style={{ opacity: respondingId === link.id ? 0.6 : 1 }}>
                <Text className="text-zinc-200">{t("caregiverView.decline")}</Text>
              </Pressable>
              <Pressable
                disabled={respondingId === link.id}
                onPress={() => respond(link.id, true)}
                className="flex-1 items-center rounded-lg bg-emerald-600 py-3"
                style={{ opacity: respondingId === link.id ? 0.6 : 1 }}>
                <Text className="font-subtitle text-white">{t("caregiverView.accept")}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {houses.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {[{ id: null, name: t("caregiverView.all") }, ...houses].map((h) => {
                const active = activeFilter === h.id;
                return (
                  <Pressable
                    key={h.id ?? "all"}
                    onPress={() => setHouseFilter(h.id)}
                    className={`rounded-full border px-4 py-2 ${
                      active ? "border-emerald-600 bg-emerald-600" : "border-zinc-700"
                    }`}>
                    <Text className={`text-sm ${active ? "text-white" : "text-zinc-300"}`}>
                      {h.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {houses
          .filter((h) => h.disabled || unavailableHouseIds.includes(h.id))
          .map((h) => (
            <View
              key={h.id}
              className="flex-row items-center gap-2 rounded-xl border border-amber-700 bg-amber-900/20 p-3">
              <Ionicons name="information-circle" size={18} color="#fbbf24" />
              <Text className="flex-1 text-sm text-amber-200">
                {unavailableHouseIds.includes(h.id)
                  ? t("caregiverView.loadFailed", { name: h.name })
                  : t("caregiverView.disabledIn", { name: h.name })}
              </Text>
            </View>
          ))}

        {houses.length > 0 && (
          <>
            <Card variant="elevated" style={{ padding: 16 }}>
              <CalendarHeader
                monthLabel={monthLabel}
                onPrev={() => changeMonth(-1)}
                onNext={() => changeMonth(1)}
                onToday={() => {
                  setSelectedDay(null);
                  setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                }}
              />
              <WeekdayHeader />
              <View className="w-full">
                {Array.from({ length: daysGrid.length / 7 }, (_, row) => (
                  <View key={row} className="flex-row">
                    {daysGrid.slice(row * 7, row * 7 + 7).map((date, col) => {
                      if (!date) {
                        return (
                          <View key={`blank-${row}-${col}`} className="aspect-square flex-1 p-1" />
                        );
                      }
                      const key = dateKey(date);
                      const dayShifts = shiftsByDate[key] ?? [];
                      const hasDay = dayShifts.some((s) => s.shift === "day");
                      const hasNight = dayShifts.some((s) => s.shift === "night");
                      const selected = selectedDay === key;
                      const bg = dayShifts.length ? "bg-emerald-600/80" : "bg-zinc-800/50";
                      const border = selected
                        ? "border-[3px] border-white"
                        : key === today
                          ? "border-[3px] border-yellow-400"
                          : `border-2 ${dayShifts.length ? "border-emerald-400" : "border-zinc-700/50"}`;

                      return (
                        <View key={key} className="aspect-square flex-1 p-1">
                          <Pressable
                            testID={`day-${key}`}
                            onPress={() => setSelectedDay(selected ? null : key)}
                            className={`h-full w-full items-center justify-center rounded-xl ${bg} ${border}`}>
                            <Text
                              className={`text-sm ${dayShifts.length ? "font-semibold text-white" : "text-zinc-400"}`}>
                              {date.getDate()}
                            </Text>
                            {dayShifts.length > 0 && (
                              <View className="flex-row gap-0.5">
                                {hasDay && <Ionicons name="sunny" size={9} color="#fde68a" />}
                                {hasNight && <Ionicons name="moon" size={9} color="#c7d2fe" />}
                              </View>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View className="mt-3 flex-row flex-wrap justify-center gap-4 rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="sunny" size={14} color="#fbbf24" />
                  <Text className="text-sm text-zinc-300">
                    {t("common.daysCount", { count: dayCount })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="moon" size={14} color="#a5b4fc" />
                  <Text className="text-sm text-zinc-300">
                    {t("common.nightsCount", { count: nightCount })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="add-circle" size={14} color="#34d399" />
                  <Text className="text-sm text-zinc-300">
                    {t("caregiverView.extras", { count: extraCount })}
                  </Text>
                </View>
              </View>
            </Card>

            <Card variant="elevated">
              <Text className="font-heading mb-1 text-lg text-zinc-100">
                {selectedDay ? formatDay(selectedDay) : t("caregiverView.upcoming")}
              </Text>
              {selectedDay ? (
                shiftsByDate[selectedDay] ? (
                  <ShiftRow
                    date={selectedDay}
                    shifts={shiftsByDate[selectedDay]}
                    showDate={false}
                  />
                ) : (
                  <Text className="py-3 text-zinc-400">{t("caregiverView.noneOnDay")}</Text>
                )
              ) : upcomingDates.length > 0 ? (
                upcomingDates.map((d) => <ShiftRow key={d} date={d} shifts={shiftsByDate[d]} />)
              ) : (
                <Text className="py-3 text-zinc-400">{t("caregiverView.noneUpcoming")}</Text>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
};
