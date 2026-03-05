import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "@/context/ScheduleContext";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { calculatePendingPayments } from "@/utils/paymentUtils";

interface HomeHeaderProps {
	onMenuPress?: () => void;
	onScrollToPendingPayments?: () => void;
}

export const HomeHeader = ({ onMenuPress, onScrollToPendingPayments }: HomeHeaderProps) => {
	const { top: topInset } = useSafeAreaInsets();
	const { caregivers, paymentHistory } = useSchedule();
	const upcomingPayments = useUpcomingPayments();
	const navigation = useNavigation<any>();

	// Calculate pending payments using the same logic as payments screen
	const pendingPayments = useMemo(() => {
		return calculatePendingPayments(upcomingPayments);
	}, [upcomingPayments]);

	const today = new Date();
	const greeting = () => {
		const hour = today.getHours();
		if (hour < 12) return "Bom dia";
		if (hour < 18) return "Boa tarde";
		return "Boa noite";
	};

	const totalPendingPayments = pendingPayments.length;

	return (
		<View
			className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 pb-6"
			style={{ paddingTop: topInset + 8 }}>
			{/* Top Row */}
			<View className="mb-4 flex-row items-center justify-between">
				<View className="flex-1">
					<Text className="font-subtitle text-sm text-white/90">{greeting()}</Text>
					<Text className="font-heading text-2xl text-white">HomeCare</Text>
				</View>
				{onMenuPress && (
					<Pressable
						onPress={onMenuPress}
						className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
						style={({ pressed }) => ({
							opacity: pressed ? 0.7 : 1,
						})}
						accessibilityLabel="Menu"
						accessibilityRole="button"
					>
						<Ionicons name="menu-outline" size={20} color="white" accessibilityLabelHidden />
					</Pressable>
				)}
			</View>

			{/* Stats Cards */}
			<View className="flex-row gap-3">
				<Pressable
					onPress={() => navigation.navigate("Caregivers")}
					className="flex-1 rounded-xl bg-white/20 p-4"
					style={({ pressed }) => ({
						opacity: pressed ? 0.8 : 1,
						transform: [{ scale: pressed ? 0.98 : 1 }],
					})}>
					<View className="mb-2 flex-row items-center justify-between">
						<Ionicons name="people-outline" size={20} color="white" />
						<Text className="text-xs text-white/80">Cuidadores</Text>
					</View>
					<Text className="font-heading text-2xl text-white">{caregivers.length}</Text>
				</Pressable>

				<Pressable
					onPress={() => navigation.navigate("History")}
					className="flex-1 rounded-xl bg-white/20 p-4"
					style={({ pressed }) => ({
						opacity: pressed ? 0.8 : 1,
						transform: [{ scale: pressed ? 0.98 : 1 }],
					})}>
					<View className="mb-2 flex-row items-center justify-between">
						<Ionicons name="card-outline" size={20} color="white" />
						<Text className="text-xs text-white/80">Pagamentos</Text>
					</View>
					<Text className="font-heading text-2xl text-white">{paymentHistory.length}</Text>
				</Pressable>

				<Pressable
					onPress={() => navigation.navigate("Payments")}
					className="flex-1 rounded-xl bg-white/20 p-4"
					style={({ pressed }) => ({
						opacity: pressed ? 0.8 : 1,
						transform: [{ scale: pressed ? 0.98 : 1 }],
					})}>
					<View className="mb-2 flex-row items-center justify-between">
						<Ionicons name="time-outline" size={20} color="white" />
						<Text className="text-xs text-white/80">Pendentes</Text>
					</View>
					<Text className="font-heading text-2xl text-white">{totalPendingPayments}</Text>
				</Pressable>
			</View>
		</View>
	);
};
