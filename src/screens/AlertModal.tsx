import { useAppTheme } from "@/theme";
import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useScreenTracking } from "@/hooks/useFirebase";

export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

export interface AlertModalParams {
  title: string;
  message: string;
  buttons: AlertButton[];
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  // Called when the alert closes without a button (backdrop, close button, back)
  onDismiss?: () => void;
}

export const AlertModal: React.FC = () => {
  const { colors } = useAppTheme();
  // Track screen view
  useScreenTracking("AlertModal", "AlertModalScreen");

  const route = useRoute();
  const navigation = useNavigation();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const params = route.params as AlertModalParams;
  const { title, message, buttons, icon = "warning", iconColor = colors.warning } = params || {};

  // Closing without a button press counts as a dismissal
  const buttonPressedRef = useRef(false);
  const onDismissRef = useRef(params?.onDismiss);
  useEffect(
    () => () => {
      if (!buttonPressedRef.current) onDismissRef.current?.();
    },
    [],
  );

  // Safety check - if no params, close modal
  useEffect(() => {
    if (!params || !title || !message || !buttons) {
      navigation.goBack();
    }
  }, [navigation, params, title, message, buttons]);

  // Early return after all hooks have been called
  if (!params || !title || !message || !buttons) {
    return null;
  }

  const handleButtonPress = (button: AlertButton) => {
    buttonPressedRef.current = true;
    // Always dismiss the modal first
    navigation.goBack();

    // Then execute the button action after a small delay to ensure modal is dismissed
    if (button.onPress) {
      setTimeout(() => {
        button.onPress!();
      }, 100);
    }
  };

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case "destructive":
        return "bg-red-600";
      case "cancel":
        return "bg-surface-raised";
      default:
        return "bg-primary";
    }
  };

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case "destructive":
        return "text-on-primary";
      case "cancel":
        return "text-content";
      default:
        return "text-on-primary";
    }
  };

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
        backgroundColor: "transparent",
      }}>
      {/* Backdrop - semi-transparent overlay */}
      <View className="absolute inset-0" style={{ backgroundColor: colors.overlay }}>
        <Pressable className="flex-1" onPress={() => navigation.goBack()} />
      </View>

      {/* Alert Modal Card */}
      <View className="bg-surface mx-4 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
        {/* Close Button */}
        <View className="absolute top-4 right-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="bg-surface-raised rounded-full p-2">
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Icon */}
        <View className="mb-4 items-center">
          <View className="bg-warning-soft mb-4 h-16 w-16 items-center justify-center rounded-full">
            <Ionicons name={icon} size={32} color={iconColor} />
          </View>
        </View>

        {/* Title */}
        <Text className="text-content mb-3 text-center text-xl font-bold">{title}</Text>

        {/* Message */}
        <Text className="text-muted mb-6 text-center leading-6">{message}</Text>

        {/* Buttons */}
        <View className="gap-3">
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleButtonPress(button)}
              className={`${getButtonStyle(button.style)} rounded-lg px-6 py-4`}>
              <Text
                className={`${getButtonTextStyle(button.style)} text-center text-lg font-semibold`}>
                {button.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};
