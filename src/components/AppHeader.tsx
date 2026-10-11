import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { AppLogo } from "./AppLogo";

interface AppHeaderProps {
  role: "manager" | "caregiver";
}

/** Top app bar: brand on the left, the signed-in person's role and initial on the right. */
export const AppHeader = ({ role }: AppHeaderProps) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { user } = useAuth();
  const firstName = (user?.displayName ?? user?.email ?? "").trim().split(/[\s@]/)[0];
  const label = [t(`common.roles.${role}`), firstName].filter(Boolean).join(" ");

  return (
    <View className="border-divider bg-surface border-b" style={{ paddingTop: top }}>
      <View className="h-[68px] flex-row items-center justify-between px-5">
        <AppLogo size={28} />
        {/* The name shrinks and truncates; the avatar keeps its size */}
        <View
          className="ml-4 flex-1 flex-row items-center justify-end gap-2"
          accessibilityLabel={label}>
          <Text className="font-subtitle text-muted shrink text-[10px]" numberOfLines={1}>
            {label}
          </Text>
          <View className="bg-primary-soft h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full">
            <Text className="font-heading text-accent text-xs">
              {(firstName[0] ?? "?").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
