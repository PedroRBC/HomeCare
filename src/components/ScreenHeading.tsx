import type { ReactNode } from "react";
import { View, Text } from "react-native";

export const ScreenHeading = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <View className="gap-2">
    <View className="flex-row items-start justify-between gap-3">
      <Text accessibilityRole="header" className="font-heading text-content flex-1 text-[24px]">
        {title}
      </Text>
      {action}
    </View>
    {subtitle && (
      <Text className="font-body text-muted text-[14px] leading-[20px]">{subtitle}</Text>
    )}
  </View>
);
