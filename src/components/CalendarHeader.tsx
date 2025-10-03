import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
	monthLabel: string;
	onPrev: () => void;
	onNext: () => void;
	onToday?: () => void;
};

export const CalendarHeader = ({ monthLabel, onPrev, onNext, onToday }: Props) => {
	return (
		<View className="mb-4 gap-2">
			{/* Month/Year Display */}
			<View className="items-center">
				<Text className="font-heading text-2xl text-zinc-50 mb-1">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
				<View className="h-1 w-16 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full" />
			</View>

			{/* Navigation Controls */}
			<View className="flex-row items-center justify-between">
				<Pressable
					onPress={onPrev}
					className="flex-row items-center gap-2 rounded-xl bg-zinc-800/50 border border-zinc-700 px-4 py-3"
					style={({ pressed }) => ({
						opacity: pressed ? 0.7 : 1,
						transform: [{ scale: pressed ? 0.95 : 1 }],
					})}
				>
					<Ionicons name="chevron-back" size={18} color="#E4E4E7" />
					<Text className="text-sm font-medium text-zinc-200">Anterior</Text>
				</Pressable>

				{onToday && (
					<Pressable
						onPress={onToday}
						className="px-4 py-2 rounded-lg bg-zinc-700/30"
						style={({ pressed }) => ({
							opacity: pressed ? 0.7 : 1,
							transform: [{ scale: pressed ? 0.95 : 1 }],
						})}
					>
						<Text className="text-xs text-zinc-400 font-medium">Hoje</Text>
					</Pressable>
				)}

				<Pressable
					onPress={onNext}
					className="flex-row items-center gap-2 rounded-xl bg-zinc-800/50 border border-zinc-700 px-4 py-3"
					style={({ pressed }) => ({
						opacity: pressed ? 0.7 : 1,
						transform: [{ scale: pressed ? 0.95 : 1 }],
					})}
				>
					<Text className="text-sm font-medium text-zinc-200">Próximo</Text>
					<Ionicons name="chevron-forward" size={18} color="#E4E4E7" />
				</Pressable>
			</View>
		</View>
	);
};
