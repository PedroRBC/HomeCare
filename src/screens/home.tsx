import React, { useMemo, useState, useRef } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import { CalendarHeader } from "@/components/CalendarHeader";
import { WeekdayHeader } from "@/components/WeekdayHeader";
import { CalendarGrid } from "@/components/CalendarGrid";
import { Legend } from "@/components/Legend";
// date helpers not needed directly here
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "@/context/ScheduleContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { NotificationStatus } from "@/components/NotificationStatus";
import { NotificationDebug } from "@/components/NotificationDebug";
import { HomeHeader } from "@/components/HomeHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { Ionicons } from "@expo/vector-icons";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { calculatePendingPayments } from "@/utils/paymentUtils";

// caregivers and payments now come from context

function useScheduleSelectors() {
	const { caregivers, getScheduledCaregivers, isPaidForCaregiverShift } = useSchedule();
	function scheduledCaregiversForDate(date: Date) {
		return getScheduledCaregivers(date);
	}
	function isDayPaidForAllCaregivers(date: Date) {
		const dayCaregivers = getScheduledCaregivers(date, "day");
		const nightCaregivers = getScheduledCaregivers(date, "night");

		if (dayCaregivers.length === 0 && nightCaregivers.length === 0) return false;

		const dayPaid = dayCaregivers.every((cg) => isPaidForCaregiverShift(cg, date, "day"));
		const nightPaid = nightCaregivers.every((cg) => isPaidForCaregiverShift(cg, date, "night"));

		return dayPaid && nightPaid;
	}
	function getDayPaymentStatus(date: Date): "none" | "partial" | "all" {
		const dayCaregivers = getScheduledCaregivers(date, "day");
		const nightCaregivers = getScheduledCaregivers(date, "night");
		const allScheduled = getScheduledCaregivers(date);

		if (allScheduled.length === 0) return "none";

		let paidShifts = 0;
		let totalShifts = 0;

		// Count day shifts
		dayCaregivers.forEach((cg) => {
			totalShifts++;
			if (isPaidForCaregiverShift(cg, date, "day")) paidShifts++;
		});

		// Count night shifts
		nightCaregivers.forEach((cg) => {
			totalShifts++;
			if (isPaidForCaregiverShift(cg, date, "night")) paidShifts++;
		});

		if (paidShifts === 0) return "none";
		if (paidShifts === totalShifts) return "all";
		return "partial";
	}
	return { caregivers, scheduledCaregiversForDate, isDayPaidForAllCaregivers, getDayPaymentStatus };
}

export const HomeScreen = () => {
	// Track screen view
	useScreenTracking("Home", "HomeScreen");

	const scrollViewRef = useRef<ScrollView>(null);
	const [currentMonth, setCurrentMonth] = useState(() => {
		const d = new Date();
		return new Date(d.getFullYear(), d.getMonth(), 1);
	});

	const { scheduledCaregiversForDate, getDayPaymentStatus, caregivers } = useScheduleSelectors();
	const upcomingPayments = useUpcomingPayments();

	// Calculate pending payments using the same logic as payments screen
	const pendingPayments = useMemo(() => {
		return calculatePendingPayments(upcomingPayments);
	}, [upcomingPayments]);

	const { daysGrid, monthLabel } = useMemo(() => {
		const year = currentMonth.getFullYear();
		const month = currentMonth.getMonth();
		const firstWeekday = new Date(year, month, 1).getDay(); // 0-6 Sun-Sat
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		const leadingBlanks = firstWeekday; // start week on Sunday
		const cells: (Date | null)[] = [];
		for (let i = 0; i < leadingBlanks; i++) cells.push(null);
		for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

		const label = currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
		return { daysGrid: cells, monthLabel: label };
	}, [currentMonth]);

	function prevMonth() {
		setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
	}
	function nextMonth() {
		setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
	}

	// Removed modal state in favor of navigation

	const navigation = useNavigation<any>();
	function onDayPress(d: Date) {
		navigation.navigate("DayDetails", { date: d.toISOString() });
	}

	// Toggling handled inside DayDetails screen via context

	return (
		<View className="flex-1 bg-zinc-900">
			<HomeHeader />
			<ConnectionStatus />

			{caregivers.length === 0 ? (
				<EmptyState
					icon="people-outline"
					title="Nenhum cuidador cadastrado"
					description="Comece adicionando sua primeira cuidadora para começar a gerenciar os pagamentos."
					actionText="Adicionar Cuidadora"
					onActionPress={() => navigation.navigate("Create")}
				/>
			) : (
				<ScrollView
					ref={scrollViewRef}
					className="flex-1"
					contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
					showsVerticalScrollIndicator={false}>
					<View className="gap-8">
						<NotificationStatus />
						{__DEV__ && <NotificationDebug />}

						{/* Calendar Section */}
						<Card variant="elevated" className="overflow-hidden">
							<View className="p-2">
								<CalendarHeader
									monthLabel={monthLabel}
									onPrev={prevMonth}
									onNext={nextMonth}
									onToday={() => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
								/>
								<WeekdayHeader />
								<CalendarGrid
									daysGrid={daysGrid}
									getDayPaymentStatus={getDayPaymentStatus}
									scheduledCaregiversForDate={scheduledCaregiversForDate}
									onDayPress={onDayPress}
								/>
								<Legend />
							</View>
						</Card>

						{/* Pending Payments Alert */}
						{pendingPayments.length > 0 && (
							<Card variant="elevated">
								<Pressable
									onPress={() => navigation.navigate("Payments")}
									className="flex-row items-center justify-between p-4"
									style={({ pressed }) => ({
										opacity: pressed ? 0.8 : 1,
									})}>
									<View className="flex-row items-center gap-3 flex-1">
										<View className="rounded-full bg-red-500/20 p-2">
											<Ionicons name="alert-circle" size={24} color="#EF4444" />
										</View>
										<View className="flex-1">
											<Text className="font-subtitle text-zinc-100">
												{pendingPayments.length} {pendingPayments.length === 1 ? "pagamento pendente" : "pagamentos pendentes"}
											</Text>
											<Text className="text-sm text-zinc-400 mt-1">
												Toque para gerenciar pagamentos
											</Text>
										</View>
									</View>
									<Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
								</Pressable>
							</Card>
						)}
					</View>
				</ScrollView>
			)}
		</View>
	);
};
