import React from "react";
import { Modal, View, Text } from "react-native";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  message: string;
};

export const MaintenanceModal = ({ visible, message }: Props) => {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/80 px-6">
        <View className="w-full max-w-sm gap-4 rounded-2xl bg-zinc-900 p-6">
          {/* Icon */}
          <View className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-600/20">
            <Text className="text-3xl">🔧</Text>
          </View>

          {/* Title */}
          <Text className="font-heading text-center text-xl font-bold text-zinc-50">
            {t("common.maintenance.title")}
          </Text>

          {/* Message */}
          <Text className="text-center text-base text-zinc-300">{message}</Text>

          {/* Info */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-sm text-zinc-500">{t("common.maintenance.tryAgain")}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};
