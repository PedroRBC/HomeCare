import { useAppTheme } from "@/theme";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useCaregiver, type CaregiverUpcomingPayment } from "@/context/CaregiverContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { AppHeader } from "@/components/AppHeader";
import { CalendarHeader } from "@/components/CalendarHeader";
import { WeekdayHeader } from "@/components/WeekdayHeader";
import { EmptyState } from "@/components/EmptyState";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { dateKey, monthKey, parseCalendarDate } from "@/utils/date";
import { groupShiftsByDate, type CaregiverShift } from "@/utils/caregiverShifts";
import { useTranslation } from "react-i18next";
import { currentLocale } from "@/i18n/locale";
import { formatDate, formatMoney, formatMonthYear, localizedDescription } from "@/i18n/format";
import { weekOfMonth } from "@/utils/caregiverPay";
import { sumAmounts } from "@/utils/paymentObligations";
import { dayHouseColors, houseColorMap, readableTextOn } from "@/utils/houseColors";
import { HouseColorPicker } from "@/components/HouseColorPicker";
import { useChosenHouseColors } from "@/hooks/useChosenHouseColors";

const UPCOMING_LIMIT = 10;

function formatDay(key: string) {
  const label = parseCalendarDate(key).toLocaleDateString(currentLocale(), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Day or night pill, followed by the extra marker when the shift is an extra
const ShiftBadge = ({ shift }: { shift: CaregiverShift }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const night = shift.shift === "night";
  return (
    <View className="flex-row items-center gap-1">
      <View className={`rounded-full px-2.5 py-1.5 ${night ? "bg-night-soft" : "bg-warning-soft"}`}>
        <Text className={`font-subtitle text-[11px] ${night ? "text-night" : "text-warning"}`}>
          {night ? t("common.night") : t("common.day")}
        </Text>
      </View>
      {shift.extra && (
        <Ionicons
          name="add-circle-outline"
          size={12}
          color={colors.accent}
          accessibilityLabel={t("caregiverView.extraLabel")}
        />
      )}
      {shift.additional && (
        <View
          className="bg-primary-soft flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5"
          accessibilityLabel={t("caregiverView.additionalLabel")}
          accessible>
          <Ionicons name="sparkles-outline" size={10} color={colors.accent} />
          <Text className="text-accent text-[9px]">{t("caregiverView.additionalLabel")}</Text>
        </View>
      )}
    </View>
  );
};

// One shift: symbol, date (or house, when the day is already selected) and the pill
const ShiftRow = ({ shift, showDate }: { shift: CaregiverShift; showDate: boolean }) => {
  const { colors } = useAppTheme();
  const night = shift.shift === "night";
  return (
    <View testID="shift-row" className="flex-row items-center gap-2.5 py-[15px]">
      <View
        className={`h-[38px] w-[34px] items-center justify-center rounded-[10px] ${
          night ? "bg-night-soft" : "bg-warning-soft"
        }`}>
        <Ionicons
          name={night ? "moon-outline" : "sunny-outline"}
          size={18}
          color={night ? colors.night : colors.warning}
        />
      </View>
      <View className="flex-1 gap-[5px]">
        {showDate ? (
          <>
            <Text className="text-content font-subtitle text-[13px]">{formatDay(shift.date)}</Text>
            <Text className="text-muted text-xs">{shift.houseName}</Text>
          </>
        ) : (
          <Text className="text-content font-subtitle text-[13px]">{shift.houseName}</Text>
        )}
      </View>
      <ShiftBadge shift={shift} />
    </View>
  );
};

// The shifts of a day, grouped by house
const shiftsByHouse = (shifts: CaregiverShift[]) => {
  const byHouse = new Map<string, CaregiverShift[]>();
  shifts.forEach((s) => byHouse.set(s.houseId, [...(byHouse.get(s.houseId) ?? []), s]));
  return [...byHouse.values()].flat();
};

// One payment period: "1ª semana de outubro" for weekly pay, the period itself otherwise
const PaymentRow = ({
  payment,
  showHouse,
}: {
  payment: CaregiverUpcomingPayment;
  showHouse: boolean;
}) => {
  const { t } = useTranslation();
  const period = localizedDescription(payment.description);
  const weekly = payment.frequency === "Semanal" ? weekOfMonth(payment.date) : null;
  const details = [
    weekly ? period : "",
    showHouse ? payment.houseName : "",
    payment.dayShifts > 0 ? t("common.daysCount", { count: payment.dayShifts }) : "",
    payment.nightShifts > 0 ? t("common.nightsCount", { count: payment.nightShifts }) : "",
  ].filter(Boolean);
  return (
    <View testID="payment-row" className="flex-row items-center gap-2.5 py-[15px]">
      <View className="flex-1 gap-[5px]">
        <Text className="text-content font-subtitle text-[13px]">
          {weekly
            ? t("caregiverView.weekOfMonth", {
                week: weekly.week,
                month: formatDate(weekly.month, { month: "long" }),
              })
            : period}
        </Text>
        <Text className="text-muted text-xs">{details.join(" • ")}</Text>
      </View>
      <View className="items-end gap-[3px]">
        <Text className="text-content font-heading text-[15px]">{formatMoney(payment.amount)}</Text>
        {!!payment.additionalAmount && (
          <Text className="text-accent text-[10px]">
            {t("caregiverView.includesAdditional", {
              amount: formatMoney(payment.additionalAmount),
            })}
          </Text>
        )}
      </View>
    </View>
  );
};

export const MyShiftsScreen = () => {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  useScreenTracking("MyShifts", "MyShiftsScreen");

  const { user } = useAuth();
  const {
    links,
    acceptedLinks,
    pendingLinks,
    respondToLink,
    shifts,
    payments,
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
  const [chosenColors, chooseColor] = useChosenHouseColors(user?.uid);
  const [editingColorOf, setEditingColorOf] = useState<string | null>(null);
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

  const colorByHouse = useMemo(
    () =>
      houseColorMap(
        houses.map((h) => h.id),
        chosenColors,
      ),
    [houses, chosenColors],
  );

  // The filtered house may have unlinked her in the meantime
  const activeFilter = houses.some((h) => h.id === houseFilter) ? houseFilter : null;
  const visibleShifts = useMemo(
    () => (activeFilter ? shifts.filter((s) => s.houseId === activeFilter) : shifts),
    [shifts, activeFilter],
  );
  const shiftsByDate = useMemo(() => groupShiftsByDate(visibleShifts), [visibleShifts]);
  const visiblePayments = activeFilter
    ? payments.filter((p) => p.houseId === activeFilter)
    : payments;

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
      <View className="bg-app flex-1">
        <AppHeader role="caregiver" />
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
  const additionalCount = monthShifts.filter((s) => s.additional).length;
  const listedShifts = selectedDay
    ? shiftsByHouse(shiftsByDate[selectedDay] ?? [])
    : upcomingDates.flatMap((d) => shiftsByHouse(shiftsByDate[d]));

  return (
    <View className="bg-app flex-1">
      <AppHeader role="caregiver" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-[22px] px-5 py-6">
          <View className="gap-2">
            <Text className="text-content font-subtitle text-[28px]">
              {t("caregiverView.title")}
            </Text>
            <Text className="text-muted text-xs leading-[17px]">
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
              className="bg-warning-soft gap-2.5 rounded-xl p-3.5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="mail-unread" size={20} color={colors.warning} />
                <Text className="text-warning font-subtitle flex-1 text-[13px]">
                  {t("caregiverView.inviteFrom", { house: link.houseName })}
                </Text>
              </View>
              <Text className="text-warning text-xs leading-[17px]">
                {t("caregiverView.registeredAs", { name: link.caregiverName })}
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  disabled={respondingId === link.id}
                  onPress={() => respond(link.id, false)}
                  className="bg-surface min-h-[48px] flex-1 items-center justify-center rounded-xl"
                  style={{ opacity: respondingId === link.id ? 0.6 : 1 }}>
                  <Text className="text-content">{t("caregiverView.decline")}</Text>
                </Pressable>
                <Pressable
                  disabled={respondingId === link.id}
                  onPress={() => respond(link.id, true)}
                  className="bg-primary min-h-[48px] flex-1 items-center justify-center rounded-xl"
                  style={{ opacity: respondingId === link.id ? 0.6 : 1 }}>
                  <Text className="font-subtitle text-on-primary">{t("caregiverView.accept")}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {houses.length > 1 && (
            <View className="flex-row flex-wrap gap-1.5">
              {[{ id: null, name: t("caregiverView.all") }, ...houses].map((h) => {
                const active = activeFilter === h.id;
                return (
                  <Pressable
                    key={h.id ?? "all"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setHouseFilter(h.id)}
                    className={`min-h-[48px] justify-center rounded-full border px-[11px] ${
                      active ? "bg-primary border-primary" : "bg-surface border-divider"
                    }`}>
                    <Text
                      className={
                        active
                          ? "font-subtitle text-on-primary text-[11px]"
                          : "text-muted text-[11px]"
                      }>
                      {h.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {houses
            .filter((h) => h.disabled || unavailableHouseIds.includes(h.id))
            .map((h) => (
              <View
                key={h.id}
                className="bg-warning-soft flex-row items-center gap-2.5 rounded-xl p-3.5">
                <Ionicons name="information-circle" size={18} color={colors.warning} />
                <Text className="text-warning flex-1 text-xs leading-[17px]">
                  {unavailableHouseIds.includes(h.id)
                    ? t("caregiverView.loadFailed", { name: h.name })
                    : t("caregiverView.disabledIn", { name: h.name })}
                </Text>
              </View>
            ))}

          {houses.length > 0 && (
            <>
              <View className="bg-surface border-divider rounded-[20px] border p-4">
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
                <View className="w-full gap-[5px]">
                  {Array.from({ length: daysGrid.length / 7 }, (_, row) => (
                    <View key={row} className="flex-row gap-1">
                      {daysGrid.slice(row * 7, row * 7 + 7).map((date, col) => {
                        if (!date) {
                          return (
                            <View key={`blank-${row}-${col}`} className="min-h-[48px] flex-1" />
                          );
                        }
                        const key = dateKey(date);
                        const dayShifts = shiftsByDate[key] ?? [];
                        const hasShifts = dayShifts.length > 0;
                        const hasDay = dayShifts.some((s) => s.shift === "day");
                        const hasNight = dayShifts.some((s) => s.shift === "night");
                        const hasExtra = dayShifts.some((s) => s.extra);
                        const hasAdditional = dayShifts.some((s) => s.additional);
                        // Two houses on the same day split the cell between their colors
                        const fills = dayHouseColors(
                          dayShifts.map((s) => s.houseId),
                          colorByHouse,
                        );
                        const selected = selectedDay === key;
                        const isToday = key === today;
                        const border = selected
                          ? "border-2 border-content"
                          : isToday
                            ? "border-[1.5px] border-warning"
                            : "";
                        // Any color can be chosen, so the number follows the fill
                        const onFill = readableTextOn(fills);
                        const numberClass = hasShifts
                          ? "text-sm font-subtitle"
                          : isToday
                            ? "text-content text-sm font-subtitle"
                            : "text-content text-sm";

                        return (
                          <Pressable
                            key={key}
                            testID={`day-${key}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={[
                              formatDate(date, {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }),
                              isToday ? t("common.today") : "",
                              hasDay ? t("common.day") : "",
                              hasNight ? t("common.night") : "",
                              hasExtra ? t("caregiverView.extraLabel") : "",
                              hasAdditional ? t("caregiverView.additionalLabel") : "",
                              !hasShifts ? t("common.noShifts") : "",
                            ]
                              .filter(Boolean)
                              .join(", ")}
                            onPress={() => setSelectedDay(selected ? null : key)}
                            className={`min-h-[48px] flex-1 items-center justify-center overflow-hidden rounded-[10px] ${
                              hasShifts ? "" : "bg-surface"
                            }`}>
                            {fills.length > 0 && (
                              <View className="absolute inset-0 flex-row">
                                {fills.map((color, i) => (
                                  <View
                                    key={i}
                                    className="flex-1"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </View>
                            )}
                            <Text className={numberClass} style={hasShifts ? onFill : undefined}>
                              {date.getDate()}
                            </Text>
                            {hasShifts && (
                              <View className="flex-row gap-0.5">
                                {hasDay && (
                                  <Ionicons
                                    name="sunny-outline"
                                    size={10}
                                    color={onFill.color}
                                    style={onFill}
                                  />
                                )}
                                {hasNight && (
                                  <Ionicons
                                    name="moon-outline"
                                    size={10}
                                    color={onFill.color}
                                    style={onFill}
                                  />
                                )}
                                {hasExtra && (
                                  <Ionicons
                                    name="add-circle-outline"
                                    size={10}
                                    color={onFill.color}
                                    style={onFill}
                                    accessibilityLabel={t("caregiverView.extraLabel")}
                                  />
                                )}
                                {hasAdditional && (
                                  <Ionicons
                                    name="sparkles-outline"
                                    size={10}
                                    color={onFill.color}
                                    style={onFill}
                                    accessibilityLabel={t("caregiverView.additionalLabel")}
                                  />
                                )}
                              </View>
                            )}
                            {border !== "" && (
                              <View
                                pointerEvents="none"
                                className={`absolute inset-0 rounded-[10px] ${border}`}
                              />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <View className="bg-divider mt-3.5 h-px" />
                <View className="mt-3.5 flex-row flex-wrap items-center justify-between gap-y-1">
                  <View className="flex-row items-center gap-[5px]">
                    <Ionicons name="sunny-outline" size={14} color={colors.warning} />
                    <Text className="text-muted text-[11px]">
                      {t("common.daysCount", { count: dayCount })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-[5px]">
                    <Ionicons name="moon-outline" size={14} color={colors.night} />
                    <Text className="text-muted text-[11px]">
                      {t("common.nightsCount", { count: nightCount })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-[5px]">
                    <Ionicons name="add-circle-outline" size={14} color={colors.accent} />
                    <Text className="text-muted text-[11px]">
                      {t("caregiverView.extras", { count: extraCount })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-[5px]">
                    <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
                    <Text className="text-muted text-[11px]">
                      {t("caregiverView.additionals", { count: additionalCount })}
                    </Text>
                  </View>
                </View>

                <View className="bg-divider mt-3.5 h-px" />
                <Text className="text-muted mt-3.5 text-[11px]">
                  {t("caregiverView.houseColors")}
                </Text>
                {houses.map((h) => {
                  const editing = editingColorOf === h.id;
                  return (
                    <View key={h.id}>
                      <Pressable
                        testID={`house-color-${h.id}`}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: editing }}
                        accessibilityLabel={t("caregiverView.houseColorOf", { name: h.name })}
                        onPress={() => setEditingColorOf(editing ? null : h.id)}
                        className="min-h-[48px] flex-row items-center gap-2.5">
                        <View
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: colorByHouse[h.id] }}
                        />
                        <Text className="text-content flex-1 text-[13px]">{h.name}</Text>
                        <Ionicons
                          name={editing ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                      {editing && (
                        <HouseColorPicker
                          color={colorByHouse[h.id]}
                          houseName={h.name}
                          onChange={(color) => chooseColor(h.id, color)}
                        />
                      )}
                    </View>
                  );
                })}
              </View>

              <View className="bg-surface border-divider rounded-[20px] border px-4 pt-4">
                <Text className="text-content font-subtitle text-base">
                  {selectedDay ? formatDay(selectedDay) : t("caregiverView.upcoming")}
                </Text>
                {listedShifts.length > 0 ? (
                  listedShifts.map((shift, i) => (
                    <React.Fragment key={`${shift.date}-${shift.houseId}-${shift.shift}`}>
                      {i > 0 && <View className="bg-divider h-px" />}
                      <ShiftRow shift={shift} showDate={!selectedDay} />
                    </React.Fragment>
                  ))
                ) : (
                  <Text className="text-muted py-3">
                    {selectedDay ? t("caregiverView.noneOnDay") : t("caregiverView.noneUpcoming")}
                  </Text>
                )}
              </View>

              <View className="bg-surface border-divider rounded-[20px] border px-4 pt-4">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="text-content font-subtitle text-base">
                    {t("caregiverView.payments")}
                  </Text>
                  {visiblePayments.length > 0 && (
                    <Text className="text-muted text-xs">
                      {t("caregiverView.paymentsTotal")}:{" "}
                      <Text className="text-content font-subtitle">
                        {formatMoney(sumAmounts(visiblePayments.map((p) => p.amount)))}
                      </Text>
                    </Text>
                  )}
                </View>
                <Text className="text-muted mt-1.5 text-[11px] leading-4">
                  {t("caregiverView.paymentsHint")}
                </Text>
                {visiblePayments.length > 0 ? (
                  visiblePayments.map((payment, i) => (
                    <React.Fragment key={`${payment.houseId}-${payment.id}`}>
                      {i > 0 && <View className="bg-divider h-px" />}
                      <PaymentRow
                        payment={payment}
                        showHouse={houses.length > 1 && !activeFilter}
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <Text className="text-muted py-3">{t("caregiverView.noPayments")}</Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
