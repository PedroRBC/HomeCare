import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { nativeApplicationVersion as AppVersion } from "expo-application";

interface AboutScreenProps {
  navigation: any;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  const { top: topInset } = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-zinc-900">
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3"
        style={{ paddingTop: topInset }}>
        <Pressable onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
          <Text className="ml-2 text-lg font-semibold text-white">Sobre o HomeCare</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}>
        {/* App Info */}
        <View className="mb-8">
          <View className="mb-6 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600">
              <Ionicons name="home" size={40} color="#FFFFFF" />
            </View>
            <Text className="mb-2 text-2xl font-bold text-zinc-50">HomeCare</Text>
            <Text className="text-zinc-400">Versão {AppVersion}</Text>
          </View>

          <Text className="mb-6 text-base leading-6 text-zinc-300">
            HomeCare é um aplicativo desenvolvido para facilitar o gerenciamento de pagamentos e
            cuidados domiciliares. Com uma interface intuitiva e funcionalidades robustas, o app
            ajuda famílias a organizarem seus cuidadores e manterem o controle financeiro.
          </Text>
        </View>

        {/* Features */}
        <View className="mb-8">
          <Text className="mb-4 text-lg font-semibold text-zinc-200">
            Principais Funcionalidades
          </Text>

          <View className="space-y-4">
            <View className="flex-row items-start">
              <View className="mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20">
                <Ionicons name="calendar" size={14} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-zinc-200">Calendário Inteligente</Text>
                <Text className="text-sm text-zinc-400">
                  Organize e visualize todos os seus compromissos
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20">
                <Ionicons name="people" size={14} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-zinc-200">Gestão de Cuidadores</Text>
                <Text className="text-sm text-zinc-400">
                  Cadastre e gerencie seus profissionais de saúde
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20">
                <Ionicons name="card" size={14} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-zinc-200">Controle Financeiro</Text>
                <Text className="text-sm text-zinc-400">
                  Acompanhe pagamentos e despesas relacionadas
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="mt-0.5 mr-3 h-6 w-6 items-center justify-center rounded-full bg-emerald-600/20">
                <Ionicons name="notifications" size={14} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-zinc-200">Lembretes Inteligentes</Text>
                <Text className="text-sm text-zinc-400">
                  Receba notificações sobre pagamentos e compromissos
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Technology Stack */}
        <View className="mb-8">
          <Text className="mb-4 text-lg font-semibold text-zinc-200">Tecnologias</Text>

          <View className="flex-row flex-wrap gap-2">
            <View className="rounded-lg bg-zinc-800 px-3 py-2">
              <Text className="text-sm font-medium text-emerald-400">React Native</Text>
            </View>
            <View className="rounded-lg bg-zinc-800 px-3 py-2">
              <Text className="text-sm font-medium text-emerald-400">Expo</Text>
            </View>
            <View className="rounded-lg bg-zinc-800 px-3 py-2">
              <Text className="text-sm font-medium text-emerald-400">Firebase</Text>
            </View>
            <View className="rounded-lg bg-zinc-800 px-3 py-2">
              <Text className="text-sm font-medium text-emerald-400">TypeScript</Text>
            </View>
            <View className="rounded-lg bg-zinc-800 px-3 py-2">
              <Text className="text-sm font-medium text-emerald-400">Tailwind CSS</Text>
            </View>
          </View>
        </View>

        {/* Footer with Lottie Animation */}
        <View className="items-center py-6">
          <View className="mb-4 h-32 w-full items-center justify-center">
            <LottieView
              source={require("../../assets/animations/home-shaking.json")}
              style={{ width: 120, height: 120 }}
              autoPlay
              loop
            />
          </View>

          <Text className="mb-2 text-center text-sm text-zinc-500">
            Desenvolvido com ❤️ para facilitar o cuidado domiciliar
          </Text>
          <Text className="text-center text-xs text-zinc-600">
            HomeCare v{AppVersion} • React Native & Expo
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
