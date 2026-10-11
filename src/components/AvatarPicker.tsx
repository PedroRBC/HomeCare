import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

export type AvatarConfig = {
  icon: string;
  color: string;
};

const AVATAR_ICONS = [
  "person",
  "person-circle",
  "happy",
  "heart",
  "star",
  "flower",
  "leaf",
  "paw",
  "sunny",
  "moon",
  "rose",
  "sparkles",
  "diamond",
  "ribbon",
  "cafe",
  "home",
  "shield",
  "medkit",
  "hand-left",
  "people",
];

const AVATAR_COLORS = [
  "#059669", // emerald-600
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
];

export const DEFAULT_AVATAR: AvatarConfig = {
  icon: "person",
  color: "#059669",
};

export function parseAvatarConfig(photoURL: string | null | undefined): AvatarConfig {
  if (!photoURL) return DEFAULT_AVATAR;
  try {
    const parsed = JSON.parse(photoURL);
    if (parsed.icon && parsed.color) return parsed;
    return DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

interface AvatarDisplayProps {
  config: AvatarConfig;
  size?: number;
}

export const AvatarDisplay = ({ config, size = 40 }: AvatarDisplayProps) => {
  const iconSize = size * 0.45;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: config.color + "30",
        borderWidth: 2,
        borderColor: config.color,
        alignItems: "center",
        justifyContent: "center",
      }}>
      <Ionicons name={config.icon as any} size={iconSize} color={config.color} />
    </View>
  );
};

interface AvatarPickerProps {
  visible: boolean;
  currentConfig: AvatarConfig;
  onSelect: (config: AvatarConfig) => void;
  onClose: () => void;
}

export const AvatarPicker = ({ visible, currentConfig, onSelect, onClose }: AvatarPickerProps) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [selectedIcon, setSelectedIcon] = useState(currentConfig.icon);
  const [selectedColor, setSelectedColor] = useState(currentConfig.color);

  const handleConfirm = () => {
    onSelect({ icon: selectedIcon, color: selectedColor });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="bg-overlay flex-1 justify-end">
        <View className="bg-surface rounded-t-3xl px-6 pt-6 pb-10">
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-content text-xl font-bold">{t("common.avatar.title")}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Preview */}
          <View className="mb-6 items-center">
            <AvatarDisplay config={{ icon: selectedIcon, color: selectedColor }} size={80} />
          </View>

          {/* Color picker */}
          <Text className="text-muted mb-3 text-sm font-semibold">{t("common.avatar.color")}</Text>
          <View className="mb-6 flex-row flex-wrap gap-3">
            {AVATAR_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setSelectedColor(color)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 3 : 0,
                  borderColor: colors.text,
                  opacity: selectedColor === color ? 1 : 0.6,
                }}
              />
            ))}
          </View>

          {/* Icon picker */}
          <Text className="text-muted mb-3 text-sm font-semibold">{t("common.avatar.icon")}</Text>
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap gap-3">
              {AVATAR_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setSelectedIcon(icon)}
                  className={`items-center justify-center rounded-xl ${
                    selectedIcon === icon ? "bg-surface-raised" : "bg-surface"
                  }`}
                  style={{
                    width: 52,
                    height: 52,
                    borderWidth: selectedIcon === icon ? 2 : 0,
                    borderColor: selectedColor,
                  }}>
                  <Ionicons
                    name={icon as any}
                    size={24}
                    color={selectedIcon === icon ? selectedColor : colors.textSecondary}
                  />
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Confirm button */}
          <Pressable
            onPress={handleConfirm}
            className="bg-primary mt-6 items-center rounded-xl py-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <Text className="text-on-primary text-lg font-semibold">
              {t("common.avatar.confirm")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
