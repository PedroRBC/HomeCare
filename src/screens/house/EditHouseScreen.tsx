import React, { useState, useEffect } from "react";
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
import { FirestoreService } from "@/services/firestore";
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
  const [managerNames, setManagerNames] = useState<Map<string, string>>(new Map());

  // Track screen view
  useScreenTracking("EditHouse", "EditHouseScreen");

  // Fetch manager names when component mounts
  useEffect(() => {
    const fetchManagerNames = async () => {
      try {
        const userIds = house.managers.map((manager) => manager.userId);
        const userProfiles = await FirestoreService.getUserProfiles(userIds);
        const namesMap = new Map<string, string>();

        userProfiles.forEach((profile, userId) => {
          namesMap.set(
            userId,
            profile.displayName || profile.email || t("houses.edit.unknownUser"),
          );
        });

        setManagerNames(namesMap);
      } catch (error) {
        console.error("Error fetching manager names:", error);
      }
    };

    fetchManagerNames();
  }, [house.managers, t]);

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({
        title: t("common.error"),
        message: t("houses.edit.nameRequired"),
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
        iconColor: "#10b981",
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

  const handleDelete = () => {
    showAlert({
      title: t("houses.edit.deleteTitle"),
      message: t("houses.edit.deleteMessage", { name: house.name }),
      icon: "trash",
      iconColor: "#ef4444",
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
        iconColor: "#10b981",
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
        iconColor: "#ef4444",
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
      iconColor: "#ef4444",
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
        iconColor: "#10b981",
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
        iconColor: "#ef4444",
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
    <View className="flex-1 bg-zinc-900" style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
          <Text className="ml-2 text-lg font-semibold text-white">{t("houses.edit.title")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        {/* House Info */}
        <View className="mb-8">
          <View className="mb-6 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600">
              <Ionicons name="home" size={40} color="#FFFFFF" />
            </View>
            <Text className="mb-2 text-xl font-bold text-zinc-50">{house.name}</Text>
            <Text className="text-center text-zinc-400">
              {house.managers.length} gerente{house.managers.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View className="gap-4">
          {/* Name Field */}
          <View>
            <Text className="mb-2 font-medium text-zinc-200">{t("houses.edit.name")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("houses.edit.namePlaceholder")}
              placeholderTextColor="#71717a"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-50"
              editable={!isLoading && !isDeleting}
            />
          </View>

          {/* Description Field */}
          <View>
            <Text className="mb-2 font-medium text-zinc-200">{t("houses.edit.description")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("houses.edit.descriptionPlaceholder")}
              placeholderTextColor="#71717a"
              multiline
              numberOfLines={3}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-50"
              editable={!isLoading && !isDeleting}
              textAlignVertical="top"
            />
          </View>

          {/* Managers List */}
          <View>
            <Text className="mb-3 font-medium text-zinc-200">{t("houses.edit.managers")}</Text>
            <View className="rounded-lg bg-zinc-800 p-4">
              {house.managers.map((manager, index) => {
                const displayName =
                  managerNames.get(manager.userId) ||
                  manager.displayName ||
                  manager.email ||
                  t("houses.edit.unknownUser");
                const initials = displayName.charAt(0).toUpperCase();
                const isCurrentUser = user?.uid === manager.userId;
                const canRemoveManager = userRole === "owner" && !isCurrentUser;

                return (
                  <View key={manager.userId} className="flex-row items-center justify-between py-2">
                    <View className="flex-1 flex-row items-center">
                      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-emerald-600">
                        <Text className="text-sm font-semibold text-white">{initials}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-zinc-50">{displayName}</Text>
                        <Text className="text-sm text-zinc-400 capitalize">
                          {manager.role === "owner"
                            ? t("houses.edit.owner")
                            : t("houses.edit.manager")}
                          {isCurrentUser && t("houses.edit.you")}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      {manager.role === "owner" && (
                        <View className="mr-2 rounded bg-emerald-600/20 px-2 py-1">
                          <Text className="text-xs font-medium text-emerald-400">
                            {t("houses.edit.owner")}
                          </Text>
                        </View>
                      )}
                      {canRemoveManager && (
                        <TouchableOpacity
                          onPress={() => handleRemoveManager(manager.userId, displayName)}
                          disabled={isRemovingManager}
                          className="rounded-full bg-red-600/20 p-2"
                          style={{ opacity: isRemovingManager ? 0.7 : 1 }}>
                          {isRemovingManager ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Ionicons name="trash" size={16} color="#ef4444" />
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
            className="items-center rounded-lg bg-emerald-600 py-4"
            style={{ opacity: isLoading || isDeleting || !name.trim() ? 0.7 : 1 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="checkmark" size={20} color="white" />
                <Text className="ml-2 text-lg font-semibold text-white">
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
              className="items-center rounded-lg bg-red-600 py-4"
              style={{ opacity: isLoading || isDeleting ? 0.7 : 1 }}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="trash" size={20} color="white" />
                  <Text className="ml-2 text-lg font-semibold text-white">
                    {t("houses.edit.delete")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Warning for non-owners */}
        {!canDelete && (
          <View className="mt-6 rounded-lg border border-amber-700 bg-amber-900/20 p-4">
            <View className="mb-2 flex-row items-center">
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text className="ml-2 font-medium text-amber-400">
                {t("houses.edit.limitedTitle")}
              </Text>
            </View>
            <Text className="text-sm text-amber-300">{t("houses.edit.limitedText")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
