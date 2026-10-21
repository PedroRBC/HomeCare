import { useAppTheme } from "@/theme";
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
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { useScreenTracking } from "@/hooks/useFirebase";
import { House } from "@/types/house.types";
import { useTranslation } from "react-i18next";

interface EditHouseScreenProps {
  navigation: any;
  route: {
    params: {
      house: House;
    };
  };
}

export const EditHouseScreen: React.FC<EditHouseScreenProps> = ({ navigation, route }) => {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { house } = route.params;
  const { updateHouse, deleteHouse, removeManager } = useHouse();
  const { user } = useAuth();
  // Role in the edited house, which is not necessarily the selected one
  const userRole = house.managers.find((m) => m.userId === user?.uid)?.role ?? null;
  const { showAlert } = useAlert();
  const { top: topInset } = useSafeAreaInsets();

  const [name, setName] = useState(house.name);
  const [description, setDescription] = useState(house.description || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingManager, setIsRemovingManager] = useState(false);

  // Track screen view
  useScreenTracking("EditHouse", "EditHouseScreen");

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({
        title: t("common.error"),
        message: t("houses.edit.nameRequired"),
        icon: "warning",
        iconColor: colors.warning,
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

      // Prepare updates object, only including description if it's not empty
      const updates: Partial<House> = {
        name: name.trim(),
      };

      // Only include description if it's not empty
      if (description.trim()) {
        updates.description = description.trim();
      }

      await updateHouse(house.id, updates);

      showAlert({
        title: t("houses.edit.success"),
        message: t("houses.edit.updated"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (error) {
      console.error("Error updating house:", error);
      showAlert({
        title: t("common.error"),
        message: t("houses.edit.updateError"),
        icon: "alert-circle",
        iconColor: colors.danger,
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

  const handleDelete = () => {
    showAlert({
      title: t("houses.edit.deleteTitle"),
      message: t("houses.edit.deleteMessage", { name: house.name }),
      icon: "trash",
      iconColor: colors.danger,
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: confirmDelete,
        },
      ],
    });
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteHouse(house.id);

      showAlert({
        title: t("houses.edit.success"),
        message: t("houses.edit.deleted"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
            onPress: () => navigation.navigate("HouseManagement", { screen: "HouseSelection" }),
          },
        ],
      });
    } catch (error) {
      console.error("Error deleting house:", error);
      showAlert({
        title: t("common.error"),
        message: t("houses.edit.deleteError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = userRole === "owner";

  const handleRemoveManager = (managerUserId: string, managerName: string) => {
    showAlert({
      title: t("houses.edit.removeTitle"),
      message: t("houses.edit.removeMessage", { name: managerName }),
      icon: "person-remove",
      iconColor: colors.danger,
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("houses.edit.remove"),
          style: "destructive",
          onPress: () => confirmRemoveManager(managerUserId),
        },
      ],
    });
  };

  const confirmRemoveManager = async (managerUserId: string) => {
    try {
      setIsRemovingManager(true);
      await removeManager(house.id, managerUserId);

      showAlert({
        title: t("houses.edit.success"),
        message: t("houses.edit.removed"),
        icon: "checkmark-circle",
        iconColor: colors.success,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    } catch (error) {
      console.error("Error removing manager:", error);
      showAlert({
        title: t("common.error"),
        message: t("houses.edit.removeError"),
        icon: "alert-circle",
        iconColor: colors.danger,
        buttons: [
          {
            text: t("common.ok"),
            style: "default",
          },
        ],
      });
    } finally {
      setIsRemovingManager(false);
    }
  };

  return (
    <View className="bg-app flex-1" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="border-divider bg-surface flex-row items-center justify-between border-b px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text className="text-content font-subtitle ml-2 text-lg">{t("houses.edit.title")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        {/* House Info */}
        <View className="mb-8">
          <View className="mb-6 items-center">
            <View className="bg-primary mb-4 h-20 w-20 items-center justify-center rounded-2xl">
              <Ionicons name="home" size={40} color={colors.onPrimary} />
            </View>
            <Text className="text-content font-heading mb-2 text-xl">{house.name}</Text>
            <Text className="text-muted text-center">
              {t("houses.select.managersCount", { count: house.managers.length })}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View className="gap-4">
          {/* Name Field */}
          <View>
            <Text className="text-content font-subtitle mb-2">{t("houses.edit.name")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("houses.edit.namePlaceholder")}
              placeholderTextColor={colors.textMuted}
              className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
              editable={!isLoading && !isDeleting}
            />
          </View>

          {/* Description Field */}
          <View>
            <Text className="text-content font-subtitle mb-2">{t("houses.edit.description")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("houses.edit.descriptionPlaceholder")}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              className="border-divider bg-surface text-content rounded-lg border px-4 py-3"
              editable={!isLoading && !isDeleting}
              textAlignVertical="top"
            />
          </View>

          {/* Managers List */}
          <View>
            <Text className="text-content font-subtitle mb-3">{t("houses.edit.managers")}</Text>
            <View className="bg-surface rounded-lg p-4">
              {house.managers.map((manager, index) => {
                const displayName =
                  manager.displayName || manager.email || t("houses.edit.unknownUser");
                const initials = displayName.charAt(0).toUpperCase();
                const isCurrentUser = user?.uid === manager.userId;
                const canRemoveManager = userRole === "owner" && !isCurrentUser;

                return (
                  <View key={manager.userId} className="flex-row items-center justify-between py-2">
                    <View className="flex-1 flex-row items-center">
                      <View className="bg-primary mr-3 h-8 w-8 items-center justify-center rounded-full">
                        <Text className="text-on-primary font-subtitle text-sm">{initials}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-content font-subtitle">{displayName}</Text>
                        <Text className="text-muted text-sm capitalize">
                          {manager.role === "owner"
                            ? t("houses.edit.owner")
                            : t("houses.edit.manager")}
                          {isCurrentUser && t("houses.edit.you")}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      {manager.role === "owner" && (
                        <View className="bg-primary-soft mr-2 rounded px-2 py-1">
                          <Text className="text-accent font-subtitle text-xs">
                            {t("houses.edit.owner")}
                          </Text>
                        </View>
                      )}
                      {canRemoveManager && (
                        <TouchableOpacity
                          onPress={() => handleRemoveManager(manager.userId, displayName)}
                          disabled={isRemovingManager}
                          className="bg-danger-soft rounded-full p-2"
                          style={{ opacity: isRemovingManager ? 0.7 : 1 }}>
                          {isRemovingManager ? (
                            <ActivityIndicator size="small" color={colors.danger} />
                          ) : (
                            <Ionicons name="trash" size={16} color={colors.danger} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="mt-8 gap-3">
          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading || isDeleting || !name.trim()}
            className="bg-primary items-center rounded-lg py-4"
            style={{ opacity: isLoading || isDeleting || !name.trim() ? 0.7 : 1 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="checkmark" size={20} color={colors.onPrimary} />
                <Text className="text-on-primary font-subtitle ml-2 text-lg">
                  {t("houses.edit.save")}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Delete Button - Only for owners */}
          {canDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isLoading || isDeleting}
              className="border-divider mt-6 items-center rounded-lg border-t py-4"
              style={{ opacity: isLoading || isDeleting ? 0.7 : 1 }}>
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="trash" size={20} color={colors.danger} />
                  <Text className="text-danger font-subtitle ml-2 text-lg">
                    {t("houses.edit.delete")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Warning for non-owners */}
        {!canDelete && (
          <View className="border-warning bg-warning-soft mt-6 rounded-lg border p-4">
            <View className="mb-2 flex-row items-center">
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text className="text-warning font-subtitle ml-2">
                {t("houses.edit.limitedTitle")}
              </Text>
            </View>
            <Text className="text-warning text-sm">{t("houses.edit.limitedText")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
