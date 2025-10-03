import React from "react";
import { View, Text } from "react-native";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const WeekdayHeader = () => (
	<View className="mb-4">
		<View className="flex-row justify-between">
			{weekdays.map((day, i) => (
				<View key={i} className="flex-1 items-center py-2">
					<Text className="text-sm font-medium text-zinc-300">{day}</Text>
				</View>
			))}
		</View>
		{/* Subtle divider line */}
		<View className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mt-2" />
	</View>
);
