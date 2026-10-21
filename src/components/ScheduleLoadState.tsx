import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

export const ScheduleLoadState = ({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => void;
}) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-4 px-5 py-8">
      {failed ? (
        <Ionicons name="cloud-offline-outline" size={36} color={colors.textSecondary} />
      ) : (
        <ActivityIndicator size="large" color={colors.accent} />
      )}
      <Text
        accessibilityRole={failed ? "alert" : undefined}
        className="font-heading text-content text-center text-lg">
        {t(failed ? "common.dataUnavailable" : "common.loading")}
      </Text>
      {failed && (
        <>
          <Text className="text-muted text-center text-sm leading-5">
            {t("common.dataUnavailableHint")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="bg-primary min-h-[48px] items-center justify-center rounded-xl px-6 py-3">
            <Text className="font-subtitle text-on-primary">{t("common.tryAgain")}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
};
