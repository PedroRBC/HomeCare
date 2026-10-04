import { useState } from "react";
import { Modal, View, Text, Pressable, Linking, ActivityIndicator } from "react-native";
import { UpdateConfig, AppUpdateService } from "@/services/appUpdateService";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  config: UpdateConfig;
  onDismiss?: () => void;
};

export const UpdateRequiredModal = ({ visible, config, onDismiss }: Props) => {
  const { t } = useTranslation();
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
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full max-w-sm gap-4 rounded-2xl bg-zinc-900 p-6">
          {/* Icon */}
          <View className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-600/20">
            <Text className="text-3xl">🔄</Text>
          </View>

          {/* Title */}
          <Text className="font-heading text-center text-xl font-bold text-zinc-50">
            {config.forceUpdate ? t("common.update.required") : t("common.update.available")}
          </Text>

          {/* Message */}
          <Text className="text-center text-base text-zinc-300">{config.updateMessage}</Text>

          {/* Version Info */}
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-sm text-zinc-500">{t("common.update.currentVersion")}</Text>
            <Text className="text-sm font-semibold text-zinc-300">{config.currentVersion}</Text>
          </View>

          {config.updateType !== "none" && (
            <View className="flex-row items-center justify-center gap-2">
              <Text className="text-sm text-zinc-500">{t("common.update.newVersion")}</Text>
              <Text className="text-sm font-semibold text-emerald-400">{config.latestVersion}</Text>
            </View>
          )}

          {/* Release Notes */}
          {config.releaseNotes && (
            <View className="rounded-lg bg-zinc-800 p-3">
              <Text className="mb-2 text-sm font-semibold text-zinc-50">
                {t("common.update.whatsNew")}
              </Text>
              <Text className="text-sm text-zinc-300">{config.releaseNotes}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3">
            <Pressable
              onPress={handleUpdate}
              disabled={isOpeningStore}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 disabled:opacity-70">
              {isOpeningStore ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text className="font-subtitle text-center text-white">
                    {t("common.update.updateNow")}
                  </Text>
                </>
              )}
            </Pressable>

            {!config.forceUpdate && onDismiss && (
              <Pressable
                onPress={onDismiss}
                className="rounded-xl border border-zinc-700 bg-transparent px-4 py-3">
                <Text className="font-subtitle text-center text-zinc-300">
                  {t("common.update.later")}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Warning for required update */}
          {config.forceUpdate && (
            <Text className="text-center text-xs text-zinc-500">
              {t("common.update.mandatory")}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};
