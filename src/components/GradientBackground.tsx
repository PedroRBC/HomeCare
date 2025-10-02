import React from "react";
import { View, ViewProps } from "react-native";

interface GradientBackgroundProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "emerald" | "blue" | "purple";
}

export const GradientBackground = ({
  children,
  variant = "default",
  className = "",
  ...props
}: GradientBackgroundProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "emerald":
        return "bg-gradient-to-br from-emerald-900 via-zinc-900 to-emerald-900";
      case "blue":
        return "bg-gradient-to-br from-blue-900 via-zinc-900 to-blue-900";
      case "purple":
        return "bg-gradient-to-br from-purple-900 via-zinc-900 to-purple-900";
      default:
        return "bg-zinc-900";
    }
  };

  return (
    <View className={`flex-1 ${getVariantStyles()} ${className}`} {...props}>
      {children}
    </View>
  );
};
