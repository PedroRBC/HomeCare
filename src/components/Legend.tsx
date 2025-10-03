import React from "react";
import { View, Text } from "react-native";

export const Legend = () => (
	<View className="mt-3 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
		<Text className="text-sm font-medium text-zinc-300 mb-3 text-center">Status dos Pagamentos</Text>
		<View className="flex-row flex-wrap items-center justify-center gap-6">
			<View className="flex-row items-center gap-2">
				<View className="h-4 w-4 rounded-lg bg-emerald-500 shadow-sm shadow-emerald-500/30" />
				<Text className="text-sm text-zinc-300 font-medium">Pago</Text>
			</View>
			<View className="flex-row items-center gap-2">
				<View className="h-4 w-4 rounded-lg bg-amber-500 shadow-sm shadow-amber-500/30" />
				<Text className="text-sm text-zinc-300 font-medium">Parcial</Text>
			</View>
			<View className="flex-row items-center gap-2">
				<View className="h-4 w-4 rounded-lg bg-rose-500 shadow-sm shadow-rose-500/30" />
				<Text className="text-sm text-zinc-300 font-medium">Pendente</Text>
			</View>
		</View>
	</View>
);
