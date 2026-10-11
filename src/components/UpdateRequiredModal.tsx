import { useState } from "react";
import { Modal, View, Text, Pressable, Linking, ActivityIndicator } from "react-native";
import { UpdateConfig, AppUpdateService } from "@/services/appUpdateService";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

type Props = {
  visible: boolean;
  config: UpdateConfig;
  onDismiss?: () => void;
};

export const UpdateRequiredModal = ({ visible, config, onDismiss }: Props) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [isOpeningStore, setIsOpeningStore] = useState(false);

  const handleUpdate = async () => {
    try {
      setIsOpeningStore(true);
      const updateUrl = await AppUpdateService.getUpdateUrl();

      const canOpen = await Linking.canOpenURL(updateUrl);
      if (canOpen) {
        await Linking.openURL(updateUrl);
      } else {
        console.error("Cannot open URL:", updateUrl);
        alert(t("common.update.storeError"));
      }
    } catch (error) {
      console.error("Error opening update URL:", error);
      alert(t("common.update.storeError"));
    } finally {
      setIsOpeningStore(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={config.forceUpdate ? undefined : onDismiss}>
      <View className="bg-overlay flex-1 items-center justify-center px-6">
        <View className="bg-surface w-full max-w-sm gap-4 rounded-2xl p-6">
          {/* Icon */}
          <View className="bg-primary-soft mx-auto flex size-16 items-center justify-center rounded-full">
            <Text className="text-3xl">🔄</Text>
          </View>

          {/* Title */}
          <Text className="font-heading text-content text-center text-xl font-bold">
            {config.forceUpdate ? t("common.update.required") : t("common.update.available")}
          </Text>

          {/* Message */}
          <Text className="text-muted text-center text-base">{config.updateMessage}</Text>

          {/* Version Info */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-subtle text-sm">{t("common.update.currentVersion")}</Text>
            <Text className="text-muted text-sm font-semibold">{config.currentVersion}</Text>
          </View>

          {config.updateType !== "none" && (
            <View className="flex-row items-center justify-center gap-2">
              <Text className="text-subtle text-sm">{t("common.update.newVersion")}</Text>
              <Text className="text-accent text-sm font-semibold">{config.latestVersion}</Text>
            </View>
          )}

          {/* Release Notes */}
          {config.releaseNotes && (
            <View className="bg-surface-raised rounded-lg p-3">
              <Text className="text-content mb-2 text-sm font-semibold">
                {t("common.update.whatsNew")}
              </Text>
              <Text className="text-muted text-sm">{config.releaseNotes}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3">
            <Pressable
              onPress={handleUpdate}
              disabled={isOpeningStore}
              className="bg-primary flex-row items-center justify-center gap-2 rounded-xl px-4 py-4 disabled:opacity-70">
              {isOpeningStore ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text className="font-subtitle text-on-primary text-center">
                    {t("common.update.updateNow")}
                  </Text>
                </>
              )}
            </Pressable>

            {!config.forceUpdate && onDismiss && (
              <Pressable
                onPress={onDismiss}
                className="border-divider rounded-xl border bg-transparent px-4 py-3">
                <Text className="font-subtitle text-muted text-center">
                  {t("common.update.later")}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Warning for required update */}
          {config.forceUpdate && (
            <Text className="text-subtle text-center text-xs">{t("common.update.mandatory")}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
};
