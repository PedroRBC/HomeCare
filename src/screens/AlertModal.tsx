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
  // Track screen view
  useScreenTracking("AlertModal", "AlertModalScreen");

  const route = useRoute();
  const navigation = useNavigation();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const params = route.params as AlertModalParams;
  const { title, message, buttons, icon = "warning", iconColor = "#f59e0b" } = params || {};

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
        return "bg-zinc-600";
      default:
        return "bg-emerald-600";
    }
  };

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case "destructive":
        return "text-white";
      case "cancel":
        return "text-white";
      default:
        return "text-white";
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
      <View className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
        <Pressable className="flex-1" onPress={() => navigation.goBack()} />
      </View>

      {/* Alert Modal Card */}
      <View className="mx-4 w-full max-w-sm rounded-2xl bg-zinc-800 p-6 shadow-2xl">
        {/* Close Button */}
        <View className="absolute top-4 right-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="rounded-full bg-zinc-700 p-2">
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Icon */}
        <View className="mb-4 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-amber-600/20">
            <Ionicons name={icon} size={32} color={iconColor} />
          </View>
        </View>

        {/* Title */}
        <Text className="mb-3 text-center text-xl font-bold text-zinc-50">{title}</Text>

        {/* Message */}
        <Text className="mb-6 text-center leading-6 text-zinc-300">{message}</Text>

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
