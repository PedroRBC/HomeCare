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
      <View className="bg-overlay flex-1 items-center justify-center px-6">
        <View className="bg-surface w-full max-w-sm gap-4 rounded-2xl p-6">
          {/* Icon */}
          <View className="bg-warning-soft mx-auto flex size-16 items-center justify-center rounded-full">
            <Text className="text-3xl">🔧</Text>
          </View>

          {/* Title */}
          <Text className="font-heading text-content text-center text-xl font-bold">
            {t("common.maintenance.title")}
          </Text>

          {/* Message */}
          <Text className="text-muted text-center text-base">{message}</Text>

          {/* Info */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-subtle text-sm">{t("common.maintenance.tryAgain")}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};
