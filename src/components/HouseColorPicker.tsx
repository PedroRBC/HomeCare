import React, { useState } from "react";
import { View, TextInput, Pressable, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";
import {
  HOUSE_COLORS,
  hexToHsl,
  hslToHex,
  normalizeHex,
  readableTextOn,
  type Hsl,
} from "@/utils/houseColors";

const SEGMENTS = 24;

type SliderProps = {
  label: string;
  value: number;
  max: number;
  unit: string;
  colorAt: (value: number) => string;
  // commit: the drag ended or a screen reader stepped, so save the color
  onChange: (value: number, commit: boolean) => void;
};

// Drag or tap along a strip previewing the colors it leads to; adjustable for screen readers
const ColorSlider = ({ label, value, max, unit, colorAt, onChange }: SliderProps) => {
  const [width, setWidth] = useState(0);
  const pick = (e: GestureResponderEvent) => {
    if (width > 0) {
      onChange(Math.round(Math.min(1, Math.max(0, e.nativeEvent.locationX / width)) * max), false);
    }
  };
  const step = (delta: number) => onChange(Math.min(max, Math.max(0, value + delta)), true);

  return (
    <View
      testID={`color-slider-${label}`}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value, text: `${value}${unit}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 5 : -5)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={pick}
      onResponderMove={pick}
      onResponderRelease={() => onChange(value, true)}
      className="h-12 justify-center">
      <View pointerEvents="none" className="h-6 flex-row overflow-hidden rounded-full">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View
            key={i}
            className="flex-1"
            style={{ backgroundColor: colorAt((max * (i + 0.5)) / SEGMENTS) }}
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        className="border-content absolute h-8 w-8 rounded-full border-[3px]"
        style={{
          left: (value / max) * width - 16,
          backgroundColor: colorAt(value),
        }}
      />
    </View>
  );
};

type Props = {
  color: string;
  houseName: string;
  onChange: (hex: string) => void;
};

// Any color: quick picks, hue/saturation/lightness strips or a typed hex code
export const HouseColorPicker = ({ color, houseName, onChange }: Props) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(color));
  const [typed, setTyped] = useState(color);
  const draft = hslToHex(hsl);

  const choose = (hex: string) => {
    setHsl(hexToHsl(hex));
    setTyped(hex);
    onChange(hex);
  };
  const slide = (next: Partial<Hsl>, commit: boolean) => {
    const merged = { ...hsl, ...next };
    setHsl(merged);
    setTyped(hslToHex(merged));
    if (commit) onChange(hslToHex(merged));
  };
  const commitTyped = () => {
    const hex = normalizeHex(typed);
    if (hex) choose(hex);
    else setTyped(color);
  };

  return (
    <View className="gap-1 pb-2">
      <View className="flex-row flex-wrap" accessibilityRole="radiogroup">
        {HOUSE_COLORS.map((preset, i) => {
          const chosen = preset === color;
          return (
            <Pressable
              key={preset}
              testID={`house-color-option-${i}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={t("caregiverView.colorOption", { number: i + 1 })}
              onPress={() => choose(preset)}
              className="h-12 w-12 items-center justify-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  chosen ? "border-content border-2" : ""
                }`}
                style={{ backgroundColor: preset }}>
                {chosen && (
                  <Ionicons name="checkmark" size={16} color={readableTextOn([preset]).color} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ColorSlider
        label={t("caregiverView.hue")}
        value={hsl.h}
        max={360}
        unit="°"
        colorAt={(h) => hslToHex({ h, s: 90, l: 50 })}
        onChange={(h, commit) => slide({ h }, commit)}
      />
      <ColorSlider
        label={t("caregiverView.saturation")}
        value={hsl.s}
        max={100}
        unit="%"
        colorAt={(s) => hslToHex({ ...hsl, s })}
        onChange={(s, commit) => slide({ s }, commit)}
      />
      <ColorSlider
        label={t("caregiverView.lightness")}
        value={hsl.l}
        max={100}
        unit="%"
        colorAt={(l) => hslToHex({ ...hsl, l })}
        onChange={(l, commit) => slide({ l }, commit)}
      />

      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 rounded-xl"
          style={{ backgroundColor: draft }}
          accessibilityLabel={t("caregiverView.houseColorOf", { name: houseName })}
        />
        <TextInput
          testID="house-color-hex"
          accessibilityLabel={t("caregiverView.hexLabel")}
          className="bg-surface text-content border-divider min-h-[48px] flex-1 rounded-xl border px-4"
          placeholder="#2E5BDE"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={commitTyped}
          onEndEditing={commitTyped}
        />
      </View>
    </View>
  );
};
