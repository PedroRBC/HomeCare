import React from "react";
import { Image, Text, View, type ViewProps } from "react-native";
import { useAppTheme } from "@/theme";

interface AppLogoProps extends ViewProps {
  size?: number;
  showWordmark?: boolean;
  inverse?: boolean;
}

export const AppLogo = ({
  size = 28,
  showWordmark = true,
  inverse,
  style,
  ...props
}: AppLogoProps) => {
  const { colors, scheme } = useAppTheme();
  const useInverse = inverse ?? scheme === "dark";

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="HomeCare"
      {...props}
      style={[{ flexDirection: "row", alignItems: "center", gap: size * (8 / 28) }, style]}>
      <Image
        source={
          useInverse
            ? require("../../assets/brand/homecare-mark-inverse.png")
            : require("../../assets/brand/homecare-mark.png")
        }
        accessible={false}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <Text
          className="font-heading"
          style={{ color: inverse ? colors.onPrimary : colors.text, fontSize: size * (2 / 3) }}>
          HomeCare
        </Text>
      )}
    </View>
  );
};
