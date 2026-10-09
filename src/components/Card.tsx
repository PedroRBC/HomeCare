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
        return "bg-surface-raised shadow-lg shadow-black/20";
      case "outlined":
        return "bg-surface border border-divider";
      default:
        return "bg-surface";
    }
  };

  return (
    <View className={`rounded-xl p-4 ${getVariantStyles()} ${className}`} {...props}>
      {children}
    </View>
  );
};
