import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHouse } from "@/context/HouseContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { useTranslation } from "react-i18next";

interface CreateHouseScreenProps {
  navigation: any;
}

export const CreateHouseScreen: React.FC<CreateHouseScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [houseName, setHouseName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { createHouse } = useHouse();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  // Track screen view
  useScreenTracking("CreateHouse", "CreateHouseScreen");

  const handleCreateHouse = async () => {
    if (!houseName.trim()) {
      showAlert({
        title: t("common.error"),
        message: t("houses.create.nameRequired"),
        icon: "warning",
        iconColor: "#f59e0b",
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
      return;
    }

    try {
      setIsLoading(true);
      await createHouse(houseName.trim(), description.trim() || undefined);

      showAlert({
        title: t("houses.create.success"),
        message: t("houses.create.created"),
        icon: "checkmark-circle",
        iconColor: "#10b981",
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
            onPress: () => {
              // The house is created and selected, so the router will automatically
              // navigate to the main app. No manual navigation needed.
            },
          },
        ],
      });
    } catch (error: any) {
      console.error("Error creating house:", error);
      showAlert({
        title: t("common.error"),
        message: t("houses.create.createError"),
        icon: "alert-circle",
        iconColor: "#ef4444",
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      className="flex-1 bg-zinc-900"
      style={{
        paddingTop: topInset,
        paddingBottom: bottomInset,
      }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-600">
              <Ionicons name="add-circle" size={40} color="white" />
            </View>
            <Text className="mb-2 text-2xl font-bold text-white">{t("houses.create.title")}</Text>
            <Text className="text-center text-zinc-400">{t("houses.create.subtitle")}</Text>
          </View>

          {/* Form */}
          <View className="gap-3 space-y-6">
            {/* House Name Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">{t("houses.create.name")}</Text>
              <View className="flex-row items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4">
                <Ionicons name="home-outline" size={20} color="#a1a1aa" />
                <TextInput
                  className="flex-1 px-3 py-4 text-white"
                  placeholder={t("houses.create.namePlaceholder")}
                  placeholderTextColor="#71717a"
                  value={houseName}
                  onChangeText={setHouseName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                  maxLength={50}
                />
              </View>
            </View>

            {/* Description Input */}
            <View>
              <Text className="mb-2 text-sm font-medium text-white">
                {t("houses.create.description")}
              </Text>
              <View className="flex-row items-start gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3">
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#a1a1aa"
                  style={{ marginTop: 4 }}
                />
                <TextInput
                  className="flex-1 px-3 py-2 text-white"
                  placeholder={t("houses.create.descriptionPlaceholder")}
                  placeholderTextColor="#71717a"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  autoCorrect={true}
                  editable={!isLoading}
                  maxLength={200}
                />
              </View>
              <Text className="mt-1 text-xs text-zinc-500">
                {description.length}/200 caracteres
              </Text>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              onPress={handleCreateHouse}
              disabled={isLoading || !houseName.trim()}
              className="mt-6 items-center rounded-lg bg-emerald-600 py-4"
              style={{ opacity: isLoading || !houseName.trim() ? 0.7 : 1 }}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark" size={20} color="white" />
                  <Text className="ml-2 text-lg font-semibold text-white">
                    {t("houses.create.submit")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => {
                // Try to go back, but handle the case where there's no previous screen
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  // If there's no previous screen, just reset the form
                  setHouseName("");
                  setDescription("");
                }
              }}
              disabled={isLoading}
              className="items-center rounded-lg bg-zinc-700 py-4"
              style={{ opacity: isLoading ? 0.7 : 1 }}>
              <Text className="text-lg font-semibold text-white">{t("houses.create.cancel")}</Text>
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View className="mt-8 rounded-lg bg-zinc-800 p-4">
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle"
                size={20}
                color="#10b981"
                style={{ marginTop: 2 }}
              />
              <View className="ml-3 flex-1">
                <Text className="mb-1 text-sm font-semibold text-emerald-500">
                  {t("houses.create.infoTitle")}
                </Text>
                <Text className="text-sm text-zinc-400">{t("houses.create.info")}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
