import React from "react";
import { View, ViewProps } from "react-native";

interface CardProps extends ViewProps {
	children: React.ReactNode;
	variant?: "default" | "elevated" | "outlined";
	className?: string;
}

export const Card = ({ children, variant = "default", className = "", ...props }: CardProps) => {
	const getVariantStyles = () => {
		switch (variant) {
			case "elevated":
				return "bg-zinc-800 shadow-lg shadow-black/20";
			case "outlined":
				return "bg-zinc-800 border border-zinc-700";
			default:
				return "bg-zinc-800";
		}
	};

	return (
		<View className={`rounded-xl p-4 ${getVariantStyles()} ${className}`} {...props}>
			{children}
		</View>
	);
};
