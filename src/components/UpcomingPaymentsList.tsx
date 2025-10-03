import React, { useState } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

type Props = {
	items: PaymentItem[];
	onMarkPaid: (item: PaymentItem) => Promise<void>;
};

export const UpcomingPaymentsList = ({ items, onMarkPaid }: Props) => {
	const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
	const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());

	const handleMarkPaid = async (item: PaymentItem) => {
		// Add to loading state
		setLoadingItems((prev) => new Set(prev).add(item.id));

		try {
			await onMarkPaid(item);

			// Add to animating state and start slide-out animation
			setAnimatingItems((prev) => new Set(prev).add(item.id));

			// Remove from loading state
			setLoadingItems((prev) => {
				const newSet = new Set(prev);
				newSet.delete(item.id);
				return newSet;
			});

			// Remove from animating state after animation completes
			setTimeout(() => {
				setAnimatingItems((prev) => {
					const newSet = new Set(prev);
					newSet.delete(item.id);
					return newSet;
				});
			}, 300);
		} catch (error) {
			// Remove from loading state on error
			setLoadingItems((prev) => {
				const newSet = new Set(prev);
				newSet.delete(item.id);
				return newSet;
			});
			console.error("Error marking payment as paid:", error);
		}
	};

	return (
		<View className="mt-2">
			<View className="gap-3">
				{items.map((item) => {
					const isLoading = loadingItems.has(item.id);
					const isAnimating = animatingItems.has(item.id);

					return (
						<Animated.View
							key={item.id}
							className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4"
							style={{
								transform: [
									{
										translateX: isAnimating ? -400 : 0,
									},
								],
								opacity: isAnimating ? 0 : 1,
							}}>
							<View className="mb-2 flex-row items-center justify-between">
								<View className="flex-1">
									<View className="mb-1 flex-row items-center gap-2">
										<Text className="font-heading text-zinc-100">{item.caregiver}</Text>
										<Text className="text-xs text-zinc-400">({item.frequency})</Text>
									</View>
									<Text className="text-xs text-zinc-400">{item.description}</Text>
									<View className="mt-1 flex-row gap-3">
										{item.dayShifts > 0 && (
											<Text className="text-xs text-zinc-500">
												{item.dayShifts} {item.dayShifts === 1 ? "Dia" : "Dias"}
											</Text>
										)}
										{item.nightShifts > 0 && (
											<Text className="text-xs text-zinc-500">
												{item.nightShifts} {item.nightShifts === 1 ? "Noite" : "Noites"}
											</Text>
										)}
									</View>
								</View>
								<View className="items-end">
									<Text className="font-heading text-lg text-amber-400">
										R$ {item.amount.toFixed(2).replace(".", ",")}
									</Text>
									<View className="mt-1 rounded bg-rose-900/40 px-2 py-1">
										<Text className="text-xs text-rose-300">Pendente</Text>
									</View>
								</View>
							</View>
							<Pressable
								onPress={() => handleMarkPaid(item)}
								disabled={isLoading}
								className={`w-full flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 ${isLoading ? "bg-zinc-600" : "bg-emerald-600"
									}`}
								style={({ pressed }) => ({
									opacity: pressed && !isLoading ? 0.8 : 1,
								})}>
								{isLoading ? (
									<>
										<Ionicons name="hourglass-outline" size={16} color="#9CA3AF" />
										<Text className="font-subtitle text-center text-zinc-300">
											Processando...
										</Text>
									</>
								) : (
									<>
										<Ionicons name="checkmark-circle-outline" size={16} color="white" />
										<Text className="font-subtitle text-center text-white">Marcar como Pago</Text>
									</>
								)}
							</Pressable>
						</Animated.View>
					);
				})}
			</View>

		</View>
	);
};
