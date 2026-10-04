import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useCaregiver } from "@/context/CaregiverContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { CalendarHeader } from "@/components/CalendarHeader";
import { WeekdayHeader } from "@/components/WeekdayHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { dateKey, monthKey, parseCalendarDate } from "@/utils/date";
import { groupShiftsByDate, type CaregiverShift } from "@/utils/caregiverShifts";

const UPCOMING_LIMIT = 10;

function formatDay(key: string) {
  const label = parseCalendarDate(key).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ShiftBadge = ({ shift }: { shift: CaregiverShift }) => (
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
      {shift.shift === "day" ? "Dia" : "Noite"}
      {shift.extra ? " · Extra" : ""}
    </Text>
  </View>
);

// One row per day and house, with that house's shifts of the day
const ShiftRow = ({ date, shifts }: { date: string; shifts: CaregiverShift[] }) => {
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
            <Text className="font-subtitle text-zinc-100">{formatDay(date)}</Text>
            <Text className="text-sm text-zinc-400">{houseShifts[0].houseName}</Text>
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
  useScreenTracking("MyShifts", "MyShiftsScreen");

  const { top: topInset } = useSafeAreaInsets();
  const { user } = useAuth();
  const { links, shifts, isLoading, unavailableHouseIds } = useCaregiver();

  const [houseFilter, setHouseFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Distinct houses, in a stable order
  const houses = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; disabled: boolean }>();
    links.forEach((l) => {
      const prev = byId.get(l.houseId);
      // Linked more than once to a house: active if any of the links is
      byId.set(l.houseId, {
        id: l.houseId,
        name: l.houseName || "Casa",
        disabled: (prev?.disabled ?? true) && !!l.disabled,
      });
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [links]);

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
      monthLabel: currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
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
        <Text className="mt-4 text-zinc-400">Carregando seus plantões...</Text>
      </View>
    );
  }

  if (links.length === 0) {
    return (
      <View className="flex-1 bg-zinc-900" style={{ paddingTop: topInset }}>
        <EmptyState
          icon="calendar-outline"
          title="Nenhuma casa vinculada"
          description={
            user?.email
              ? `Peça ao gerente da casa para cadastrar o email ${user.email} na sua ficha de cuidadora. Seus plantões aparecerão aqui automaticamente.`
              : "Sua conta não tem um email. Entre com uma conta de email para ver seus plantões."
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
          <Text className="font-heading text-2xl text-zinc-50">Meus Plantões</Text>
          <Text className="text-sm text-zinc-400">
            {houses.length === 1
              ? `Escala de ${houses[0].name}`
              : `Escala de ${houses.length} casas`}{" "}
            • atualizada em tempo real
          </Text>
        </View>

        {houses.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {[{ id: null, name: "Todas" }, ...houses].map((h) => {
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
                  ? `Não foi possível carregar a escala de ${h.name}.`
                  : `Você está desabilitada em ${h.name}. Os plantões anteriores continuam visíveis.`}
              </Text>
            </View>
          ))}

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
              <Text className="text-sm text-zinc-300">{dayCount} Dia</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="moon" size={14} color="#a5b4fc" />
              <Text className="text-sm text-zinc-300">{nightCount} Noite</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="add-circle" size={14} color="#34d399" />
              <Text className="text-sm text-zinc-300">
                {extraCount} Extra{extraCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </Card>

        <Card variant="elevated">
          <Text className="font-heading mb-1 text-lg text-zinc-100">
            {selectedDay ? formatDay(selectedDay) : "Próximos plantões"}
          </Text>
          {selectedDay ? (
            shiftsByDate[selectedDay] ? (
              <ShiftRow date={selectedDay} shifts={shiftsByDate[selectedDay]} />
            ) : (
              <Text className="py-3 text-zinc-400">Nenhum plantão neste dia.</Text>
            )
          ) : upcomingDates.length > 0 ? (
            upcomingDates.map((d) => <ShiftRow key={d} date={d} shifts={shiftsByDate[d]} />)
          ) : (
            <Text className="py-3 text-zinc-400">Nenhum plantão agendado a partir de hoje.</Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};
