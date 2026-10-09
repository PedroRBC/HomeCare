import { useAppTheme } from "@/theme";
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
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
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
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${"bg-primary-soft"}`}>
      <Ionicons name={shift.shift === "day" ? "sunny" : "moon"} size={12} color={colors.accent} />
      <Text className="text-content text-xs">
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
          className="border-divider/60 flex-row items-center justify-between border-b py-3">
          <View className="flex-1 pr-2">
            {showDate && <Text className="font-subtitle text-content">{formatDay(date)}</Text>}
            <Text className={showDate ? "text-muted text-sm" : "font-subtitle text-content"}>
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
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
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
        iconColor: colors.danger,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- month label depends on the active language
  }, [currentMonth, visibleShifts, i18n.language]);

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
      <View className="bg-app flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.accent} />
        <Text className="text-muted mt-4">{t("caregiverView.loading")}</Text>
      </View>
    );
  }

  if (links.length === 0) {
    return (
      <View className="bg-app flex-1" style={{ paddingTop: topInset }}>
        <View className="px-4 pt-4">
          <EmailVerificationBanner />
        </View>
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
    <View className="bg-app flex-1">
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset + 16,
          paddingBottom: 32,
          paddingHorizontal: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <View>
          <Text className="font-heading text-content text-2xl">{t("caregiverView.title")}</Text>
          <Text className="text-muted text-sm">
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
            className="border-warning bg-warning-soft gap-3 rounded-xl border p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-unread" size={20} color={colors.warning} />
              <Text className="font-subtitle text-content flex-1">
                {t("caregiverView.inviteFrom", { house: link.houseName })}
              </Text>
            </View>
            <Text className="text-warning text-sm">
              {t("caregiverView.registeredAs", { name: link.caregiverName })}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                disabled={respondingId === link.id}
                onPress={() => respond(link.id, false)}
                className="border-divider flex-1 items-center rounded-lg border py-3"
                style={{ opacity: respondingId === link.id ? 0.6 : 1 }}>
                <Text className="text-content">{t("caregiverView.decline")}</Text>
              </Pressable>
              <Pressable
                disabled={respondingId === link.id}
                onPress={() => respond(link.id, true)}
                className="bg-primary flex-1 items-center rounded-lg py-3"
                style={{ opacity: respondingId === link.id ? 0.6 : 1 }}>
                <Text className="font-subtitle text-on-primary">{t("caregiverView.accept")}</Text>
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
                      active ? "border-primary bg-primary" : "border-divider"
                    }`}>
                    <Text className={`text-sm ${active ? "text-on-primary" : "text-muted"}`}>
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
              className="border-warning bg-warning-soft flex-row items-center gap-2 rounded-xl border p-3">
              <Ionicons name="information-circle" size={18} color={colors.warning} />
              <Text className="text-warning flex-1 text-sm">
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
                      const bg = dayShifts.length ? "bg-primary-soft" : "bg-surface-raised";
                      const border = selected
                        ? "border-[3px] border-accent"
                        : key === today
                          ? "border-[3px] border-content"
                          : `border-2 ${dayShifts.length ? "border-accent/50" : "border-divider"}`;

                      return (
                        <View key={key} className="aspect-square flex-1 p-1">
                          <Pressable
                            testID={`day-${key}`}
                            onPress={() => setSelectedDay(selected ? null : key)}
                            className={`h-full w-full items-center justify-center rounded-xl ${bg} ${border}`}>
                            <Text
                              className={`text-sm ${dayShifts.length ? "text-content font-semibold" : "text-muted"}`}>
                              {date.getDate()}
                            </Text>
                            {dayShifts.length > 0 && (
                              <View className="flex-row gap-0.5">
                                {hasDay && <Ionicons name="sunny" size={9} color={colors.accent} />}
                                {hasNight && (
                                  <Ionicons name="moon" size={9} color={colors.accent} />
                                )}
                              </View>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View className="border-divider/50 bg-surface/30 mt-3 flex-row flex-wrap justify-center gap-4 rounded-xl border p-3">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="sunny" size={14} color={colors.accent} />
                  <Text className="text-muted text-sm">
                    {t("common.daysCount", { count: dayCount })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="moon" size={14} color={colors.accent} />
                  <Text className="text-muted text-sm">
                    {t("common.nightsCount", { count: nightCount })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="add-circle" size={14} color={colors.accent} />
                  <Text className="text-muted text-sm">
                    {t("caregiverView.extras", { count: extraCount })}
                  </Text>
                </View>
              </View>
            </Card>

            <Card variant="elevated">
              <Text className="font-heading text-content mb-1 text-lg">
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
                  <Text className="text-muted py-3">{t("caregiverView.noneOnDay")}</Text>
                )
              ) : upcomingDates.length > 0 ? (
                upcomingDates.map((d) => <ShiftRow key={d} date={d} shifts={shiftsByDate[d]} />)
              ) : (
                <Text className="text-muted py-3">{t("caregiverView.noneUpcoming")}</Text>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
};
