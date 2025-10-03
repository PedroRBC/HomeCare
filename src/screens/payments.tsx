import React, { useMemo, useState } from "react";
import {
	View,
	Text,
	ScrollView,
	Pressable,
	RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useSchedule } from "@/context/ScheduleContext";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { UpcomingPaymentsList } from "@/components/UpcomingPaymentsList";
import { Card } from "@/components/Card";
import { useScreenTracking } from "@/hooks/useFirebase";
import { calculatePendingPayments, isPaymentDueToday, isPaymentOverdue } from "@/utils/paymentUtils";

type PaymentItem = {
	id: string;
	caregiver: string;
	caregiverId: string;
	date: Date;
	paid: boolean;
	frequency: "Semanal" | "Quinzenal" | "Mensal";
	description: string;
	amount: number;
	daysWorked: number;
	dayShifts: number;
	nightShifts: number;
	periodKey: string;
};


export const PaymentsScreen = () => {
	// Track screen view
	useScreenTracking("Payments", "PaymentsScreen");

	const navigation = useNavigation();
	const { top: topInset } = useSafeAreaInsets();
	const { markPaidForPeriod } = useSchedule();
	const upcomingPayments = useUpcomingPayments();
	const [refreshing, setRefreshing] = useState(false);

	// Calculate pending payments (only payments that are due today or overdue)
	const pendingPayments = useMemo(() => {
		return calculatePendingPayments(upcomingPayments);
	}, [upcomingPayments]);

	// Calculate upcoming payments (future periods that are not yet due)
	const upcoming = useMemo(() => {
		const today = new Date();
		return upcomingPayments.filter((payment) => {
			const isDueToday = isPaymentDueToday(today, payment.date, payment.frequency);
			const isOverdue = isPaymentOverdue(today, payment.date, payment.frequency);
			return !isDueToday && !isOverdue;
		});
	}, [upcomingPayments]);


	const handleMarkPaid = async (item: PaymentItem) => {
		try {
			await markPaidForPeriod(item.caregiverId, item.periodKey, item.frequency);
		} catch (error) {
			console.error("Error marking payment:", error);
		}
	};

	const onRefresh = async () => {
		setRefreshing(true);
		// The useUpcomingPayments hook will automatically refresh
		// when the underlying data changes
		setTimeout(() => setRefreshing(false), 1000);
	};

	const totalPendingAmount = pendingPayments.reduce((sum, item) => sum + item.amount, 0);
	const totalUpcomingAmount = upcoming.reduce((sum, item) => sum + item.amount, 0);

	return (
		<View className="flex-1 bg-zinc-900">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ paddingTop: topInset + 20, paddingBottom: 100 }}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
			>
				<View className="px-4">
					{/* Header */}
					<View className="mb-6">
						<Text className="text-3xl font-bold text-white mb-2">Pagamentos</Text>
						<Text className="text-zinc-400">
							Gerencie pagamentos pendentes e futuros
						</Text>
					</View>

					{/* Pending Payments Section */}
					<View className="mb-8">
						<View className="flex-row items-center justify-between mb-4">
							<View className="flex-row items-center gap-2">
								<Ionicons name="alert-circle" size={20} color="#EF4444" />
								<Text className="text-xl font-semibold text-white">
									Pagamentos Pendentes
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Text className="text-sm text-zinc-400">
									{pendingPayments.length} {pendingPayments.length === 1 ? "item" : "itens"}
								</Text>
								<Text className="text-lg font-bold text-red-400">
									R$ {totalPendingAmount.toFixed(2).replace(".", ",")}
								</Text>
							</View>
						</View>

						{pendingPayments.length > 0 ? (
							<UpcomingPaymentsList
								items={pendingPayments}
								onMarkPaid={handleMarkPaid}
							/>
						) : (
							<Card variant="elevated">
								<View className="p-4 items-center">
									<Ionicons name="checkmark-circle" size={48} color="#10B981" />
									<Text className="text-lg font-semibold text-white mt-2">
										Nenhum pagamento pendente
									</Text>
									<Text className="text-zinc-400 text-center mt-1">
										Todos os pagamentos estão em dia!
									</Text>
								</View>
							</Card>
						)}
					</View>

					{/* Upcoming Payments Section */}
					<View className="mb-8">
						<View className="flex-row items-center justify-between mb-4">
							<View className="flex-row items-center gap-2">
								<Ionicons name="calendar" size={20} color="#3B82F6" />
								<Text className="text-xl font-semibold text-white">
									Próximos Pagamentos
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Text className="text-sm text-zinc-400">
									{upcoming.length} {upcoming.length === 1 ? "item" : "itens"}
								</Text>
								<Text className="text-lg font-bold text-blue-400">
									R$ {totalUpcomingAmount.toFixed(2).replace(".", ",")}
								</Text>
							</View>
						</View>

						{upcoming.length > 0 ? (
							<UpcomingPaymentsList
								items={upcoming}
								onMarkPaid={handleMarkPaid}
							/>
						) : (
							<Card variant="elevated">
								<View className="p-4 items-center">
									<Ionicons name="calendar-outline" size={48} color="#6B7280" />
									<Text className="text-lg font-semibold text-white mt-2">
										Nenhum pagamento futuro
									</Text>
									<Text className="text-zinc-400 text-center mt-1">
										Não há pagamentos programados
									</Text>
								</View>
							</Card>
						)}
					</View>

					{/* Quick Actions */}
					<View className="mb-6">
						<Text className="text-lg font-semibold text-white mb-4">
							Ações Rápidas
						</Text>
						<View className="flex-row gap-3">
							<Pressable
								onPress={() => navigation.navigate("DayCalendar" as never)}
								className="flex-1 bg-emerald-600 rounded-lg p-4 items-center"
							>
								<Ionicons name="calendar-outline" size={24} color="white" />
								<Text className="text-white font-semibold mt-2">Calendário</Text>
							</Pressable>
							<Pressable
								onPress={() => navigation.navigate("History" as never)}
								className="flex-1 bg-blue-600 rounded-lg p-4 items-center"
							>
								<Ionicons name="time-outline" size={24} color="white" />
								<Text className="text-white font-semibold mt-2">Histórico</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};
