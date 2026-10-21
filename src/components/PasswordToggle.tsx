import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

export const PasswordToggle = ({
  visible,
  disabled = false,
  onPress,
}: {
  visible: boolean;
  disabled?: boolean;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t(visible ? "common.hidePassword" : "common.showPassword")}
      accessibilityState={{ disabled }}
      className="h-[48px] w-[48px] items-center justify-center"
      style={({ pressed }) => ({ opacity: disabled || pressed ? 0.6 : 1 })}>
      <Ionicons
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={20}
        color={colors.textSecondary}
        accessible={false}
      />
    </Pressable>
  );
};
