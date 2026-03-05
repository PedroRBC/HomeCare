import React, { useState, useRef } from "react";
import { View, Text, Pressable, Dimensions, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

const { width } = Dimensions.get("window");

type Slide = {
  icon: string;
  title: string;
  description: string;
  color: string;
};

const SLIDES: Slide[] = [
  {
    icon: "home-outline",
    title: "Bem-vindo ao HomeCare",
    description:
      "Gerencie cuidadores domiciliares de forma simples e organizada. Tudo em um só lugar.",
    color: "#059669",
  },
  {
    icon: "calendar-outline",
    title: "Agende Turnos",
    description:
      "Organize turnos diurnos e noturnos para cada cuidador. Visualize tudo no calendário mensal.",
    color: "#3b82f6",
  },
  {
    icon: "card-outline",
    title: "Controle Pagamentos",
    description:
      "Acompanhe pagamentos semanais, quinzenais ou mensais. Receba alertas de pagamentos pendentes.",
    color: "#f59e0b",
  },
  {
    icon: "people-outline",
    title: "Gerencie Casas",
    description: "Gerencie múltiplas casas e convide familiares para colaborar no cuidado.",
    color: "#8b5cf6",
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen = ({ onComplete }: OnboardingScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={{ width, paddingHorizontal: 40 }} className="flex-1 items-center justify-center">
      <Animated.View entering={FadeInDown.duration(600)} className="items-center">
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: item.color + "20",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}>
          <Ionicons name={item.icon as any} size={56} color={item.color} />
        </View>
        <Text className="mb-4 text-center text-3xl font-bold text-white">{item.title}</Text>
        <Text className="text-center text-base leading-6 text-zinc-400">{item.description}</Text>
      </Animated.View>
    </View>
  );

  return (
    <View
      className="flex-1 bg-zinc-900"
      style={{ paddingTop: topInset, paddingBottom: bottomInset }}>
      {/* Skip button */}
      <View className="flex-row justify-end px-6 py-4">
        <Pressable onPress={handleSkip}>
          <Text className="text-base text-zinc-400">Pular</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(_, i) => i.toString()}
      />

      {/* Footer */}
      <View className="px-8 pb-8">
        {/* Dots */}
        <View className="mb-8 flex-row items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: currentIndex === i ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: currentIndex === i ? "#059669" : "#3f3f46",
              }}
            />
          ))}
        </View>

        {/* Button */}
        <Pressable
          onPress={handleNext}
          className="items-center rounded-xl bg-emerald-600 py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          <Text className="text-lg font-semibold text-white">
            {currentIndex === SLIDES.length - 1 ? "Começar" : "Próximo"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
